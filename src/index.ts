import crypto from "crypto";
import { Client, ConnectConfig } from "ssh2";
import { promisify } from "util";
import { invariant } from "./invariant";

const generateKeyPair = promisify(crypto.generateKeyPair);

/** Regex to match ANSI colour codes. As a TUI, Snips.sh includes these. */
const ANSI_CODE_PATTERN =
  // eslint-disable-next-line no-control-regex
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

/** Removes any ANSI colour codes from the given input. */
export const stripAnsi = (str: string) => str.replace(ANSI_CODE_PATTERN, "");

export const extractId = (str: string) =>
  str.match(/id: ([A-Za-z0-9_-]{10})/)?.[1] ?? null;

export const extractSize = (str: string) => {
  const match = str.match(/size: ([0-9]+) ([A-Z]{1})/);

  return {
    value: match?.[1] ? parseInt(match?.[1]) : null,
    unit: match?.[2] ?? null,
  };
};

export const extractType = (str: string) =>
  str.match(/type: ([a-z]+)/)?.[1] ?? null;

export const extractVisibility = (str: string) =>
  str.match(/visibility: ([a-z]+)/)?.[1] ?? null;

export const extractSsh = (str: string) => str.match(/ssh (.+)/)?.[1] ?? null;

/** Finds and returns the first URL found in the given input. */
export const extractUrl = (str: string) =>
  str.match(/https?:\/\/[^\s]+/)?.[0] ?? null;

/** Creates a new SSH client and waits for connection before resolving. */
const connectClient = async (clientOptions: ConnectConfig): Promise<Client> => {
  const client = new Client();

  return new Promise<Client>((resolve, reject) => {
    client.on("error", reject);

    client.on("ready", () => {
      client.removeListener("error", reject);

      resolve(client);
    });

    client.on("end", () => {
      reject(new Error("Client ended unexpectedly"));
    });

    client.on("close", () => {
      reject(new Error("Client closed unexpectedly"));
    });

    client.connect(clientOptions);
  });
};

const writeWithCommand = (client: Client, command: string[], content: string) =>
  new Promise<string>((resolve, reject) => {
    client.exec(command.join(" "), (err, channel) => {
      if (err) {
        return reject(err);
      }

      const data: Buffer[] = [];

      channel.on("data", (chunk: Buffer) => {
        data.push(chunk);
      });

      channel.on("close", () => {
        const result = data.map((chunk) => chunk.toString("utf8")).join("");

        resolve(result);
      });

      channel.end(content);
    });
  });

class Snip {
  constructor(
    public id: string,
    public size: { value: number; unit: string },
    public type: string,
    public visibility: "public" | "private",
    public ssh: string,
    public url: string | null,
    private clientOptions: ConnectConfig
  ) {}

  async sign() {
    const client = await connectClient({
      ...this.clientOptions,
      username: `f:${this.id}`,
    });

    const result = await writeWithCommand(client, ["sign", "-ttl", "5m"], "");

    client.destroy();

    console.log(result);

    return result;
  }
}

/** A client for uploading to https://snips.sh (or a self-hosted instance!) */
export class Snips {
  private clientOptions: ConnectConfig = {};

  /**
   * @param clientOptions - Options to pass to the SSH2 client. Defaults to
   * using snips.sh host but this can be overridden if self-hosting. If no
   * private key is provided, one will be generated. Please note that if you
   * don't store the generated key, you won't be able to manage created content
   * afterwards.
   */
  constructor(clientOptions?: Partial<ConnectConfig>) {
    this.clientOptions = {
      host: "snips.sh",
      username: "ubuntu",
      privateKey: undefined,
      ...clientOptions,
    };
  }

  /**
   * Generates defaults for any options. This happens automatically when you
   * call `upload`, but you can call this manually if you want to generate the
   * credentials ahead of time.
   *
   * @returns The client options object, with any defaults filled in.
   */
  async setup() {
    if (!this.clientOptions.privateKey) {
      const { privateKey } = await generateKeyPair("rsa", {
        modulusLength: 4096,
      });

      this.clientOptions.privateKey = privateKey
        .export({ type: "pkcs1", format: "pem" })
        .toString();
    }

    return this.clientOptions;
  }

  /**
   * Uploads a snip to the configured host.
   *
   * @param content - Body of snip to upload.
   * @returns URL of uploaded snip.
   */
  async upload(content: string, { isPrivate = false } = {}) {
    const clientOptions = await this.setup();

    const client = await connectClient(clientOptions);

    const command: string[] = [];

    if (isPrivate) {
      command.push("-private");
    }

    const response = await writeWithCommand(client, command, content);

    client.destroy();

    console.log(response);

    const sanitizedResponse = stripAnsi(response);

    const id: string | null = extractId(sanitizedResponse);
    invariant(id, "Failed to extract ID from response");

    const { unit, value } = extractSize(sanitizedResponse);
    invariant(value && unit, "Failed to extract size from response");

    const type = extractType(sanitizedResponse);
    invariant(type, "Failed to extract type from response");

    const visibility = extractVisibility(sanitizedResponse);
    invariant(
      visibility === "public" || visibility === "private",
      "Failed to extract visibility from response"
    );

    const ssh = extractSsh(sanitizedResponse);
    invariant(ssh, "Failed to extract SSH host from response");

    const url = extractUrl(sanitizedResponse);
    invariant(
      (url && visibility === "public") || (!url && visibility === "private"),
      `Visibility is ${visibility} but ${url ? "found" : "didn't find"} URL`
    );

    return new Snip(
      id,
      { unit, value },
      type,
      visibility,
      ssh,
      url,
      clientOptions
    );
  }
}
