import { Snips, extractUrl, stripAnsi } from "../src";

describe("stripAnsi", () => {
  it("strips ansi", () => {
    const str = `
      [38;5;72m┃[0m [1;38;5;72mFile Uploaded 📤[0m
      [38;5;72m┃[0m [90mid: [37mdFOPGgAEnZ[0m[0m
      [38;5;72m┃[0m [90m[90msize: [0m[37m63 B[0m[90m • [0m[90mtype: [0m[37mplaintext[0m[90m • [0m[90mvisibility: [0m[37mpublic[0m[0m
      ┃ [1mSSH 📠[0m
      ┃ [1mURL 🔗[0m
      ┃ [90m[4;38;5;75;4mh[0m[4;38;5;75;4mt[0m[4;38;5;75;4mt[0m[4;38;5;75;4mp[0m[4;38;5;75;4ms[0m[4;38;5;75;4m:[0m[4;38;5;75;4m/[0m[4;38;5;75;4m/[0m[4;38;5;75;4ms[0m[4;38;5;75;4mn[0m[4;38;5;75;4mi[0m[4;38;5;75;4mp[0m[4;38;5;75;4ms[0m[4;38;5;75;4m.[0m[4;38;5;75;4ms[0m[4;38;5;75;4mh[0m[4;38;5;75;4m/[0m[4;38;5;75;4mf[0m[4;38;5;75;4m/[0m[4;38;5;75;4md[0m[4;38;5;75;4mF[0m[4;38;5;75;4mO[0m[4;38;5;75;4mP[0m[4;38;5;75;4mG[0m[4;38;5;75;4mg[0m[4;38;5;75;4mA[0m[4;38;5;75;4mE[0m[4;38;5;75;4mn[0m[4;38;5;75;4mZ[0m[0m
    `;

    expect(stripAnsi(str)).toBe(`
      ┃ File Uploaded 📤
      ┃ id: dFOPGgAEnZ
      ┃ size: 63 B • type: plaintext • visibility: public
      ┃ SSH 📠
      ┃ URL 🔗
      ┃ https://snips.sh/f/dFOPGgAEnZ
    `);
  });
});

describe("extractUrl", () => {
  it("extracts valid URL from sample snips.sh response", () => {
    const str = `
      ┃ File Uploaded 📤
      ┃ id: dFOPGgAEnZ
      ┃ size: 63 B • type: plaintext • visibility: public
      ┃ SSH 📠
      ┃ URL 🔗
      ┃ https://snips.sh/f/dFOPGgAEnZ
    `;
    const result = extractUrl(str);
    expect(result).toBe("https://snips.sh/f/dFOPGgAEnZ");
  });

  it("extracts a valid URL from a string", () => {
    const str = "Check out this cool website: https://www.example.com";
    const result = extractUrl(str);
    expect(result).toBe("https://www.example.com");
  });

  it("returns null if no URL is found in the string", () => {
    const str = "This string does not contain a URL";
    const result = extractUrl(str);
    expect(result).toBeNull();
  });

  it("extracts only the first URL in the string", () => {
    const str =
      "https://www.example.com is a great website, but so is https://www.anotherexample.com";
    const result = extractUrl(str);
    expect(result).toBe("https://www.example.com");
  });
});

describe("Snips", () => {
  it("uploads a snip", async () => {
    const { id, url } = await new Snips().upload("Hello!");

    expect(id).toMatch(/[A-Za-z0-9_-]{10}/);
    expect(url).toBe(`https://snips.sh/f/${id}`);
  }, 10000);

  it("uploads many snips", async () => {
    const client = new Snips();

    const { id: firstId, url: firstUrl } = await client.upload("A snip");
    expect(firstId).toMatch(/[A-Za-z0-9_-]{10}/);
    expect(firstUrl).toBe(`https://snips.sh/f/${firstId}`);

    const { id: secondId, url: secondUrl } = await client.upload(
      "Another snip"
    );
    expect(secondId).toMatch(/[A-Za-z0-9_-]{10}/);
    expect(secondUrl).toBe(`https://snips.sh/f/${secondId}`);
  }, 10000);
});
