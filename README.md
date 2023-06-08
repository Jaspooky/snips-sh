# snips-sh

![npm](https://img.shields.io/npm/v/snips-sh?style=flat-square)

Wrapper for communicating with [snips.sh](https://snips.sh) in Node.js

## Getting Started

### Install the package!

```
npm i -E snips-sh
```

### Upload a snip!
```js
import { Snips } from "snips-sh";

const client = new Snips();

// Optional, `upload` will call this implicitly during an instance's first upload if a key isn't provided in the constructor.
const { privateKey } = await client.setup();

const { id, url } = await client.upload("Some content to upload!");
```
