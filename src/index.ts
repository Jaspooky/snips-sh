import crypto, { KeyObject } from "crypto";
import { Client, ConnectConfig } from "ssh2";
import { promisify } from "util";

const generateKeyPair = promisify(crypto.generateKeyPair);

/** Regex to match ANSI colour codes. As a TUI, Snips.sh includes these. */
const ANSI_CODE_PATTERN =
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

/** Removes any ANSI colour codes from the given input. */
export const stripAnsi = (str: string) => str.replace(ANSI_CODE_PATTERN, "");

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

/** A client for uploading to https://snips.sh (or a self-hosted instance!) */
export class Snips {
  private clientOptions: ConnectConfig = {};

  /**
   * @param options - Options to pass to the SSH2 client. Defaults to using
   * snips.sh host but this can be overridden if self-hosting. If no private key
   * is provided, one will be generated. Please note that if you don't store the
   * generated key, you won't be able to manage created content afterwards.
   */
  constructor(options?: Partial<ConnectConfig>) {
    this.clientOptions = {
      host: "snips.sh",
      username: "ubuntu",
      privateKey: undefined,
      ...options,
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
  async upload(content: string): Promise<{ id: string; url: string }> {
    const clientOptions = await this.setup();

    const client = await connectClient(clientOptions);

    const response = await new Promise<string>((resolve, reject) => {
      client.exec("", (err, channel) => {
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

    client.destroy();

    const sanitizedResponse = stripAnsi(response);

    const url = extractUrl(sanitizedResponse);

    if (!url) {
      throw new Error("Response didn't contain a URL. How bizarre.");
    }

    const id = url.split("/").pop()!;

    return { id, url };
  }
}
