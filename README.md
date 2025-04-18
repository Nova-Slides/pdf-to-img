This version is based on [pdf-to-img v3](https://github.com/k-yle/pdf-to-img) and adds the following options
- `maxWidth` Maximum width of the output image
- `maxHeight` Maximum height of the output image
- `maintainAspectRatio` If true, maintain aspect ratio when maxWidth or maxHeight are specified. Defaults to true.


# pdf-to-img

[![Build Status](https://github.com/k-yle/pdf-to-img/workflows/Build%20and%20Test/badge.svg)](https://github.com/k-yle/pdf-to-img/actions)
[![Coverage Status](https://coveralls.io/repos/github/k-yle/pdf-to-img/badge.svg?branch=main&t=LQmPNl)](https://coveralls.io/github/k-yle/pdf-to-img?branch=main)
[![npm version](https://badge.fury.io/js/pdf-to-img.svg)](https://badge.fury.io/js/pdf-to-img)
[![npm](https://img.shields.io/npm/dt/pdf-to-img.svg)](https://www.npmjs.com/package/pdf-to-img)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/pdf-to-img)

📃📸 Converts PDFs to images in nodejs.

Useful for unit tests of PDFs

Supports nodejs v16.17+, and comes with a CLI.

## Install

```sh
npm install -S pdf-to-img
```

## Example

NodeJS:

```js
const { promises: fs } = require("node:fs");
const { pdf } = require("pdf-to-img");

async function main() {
  let counter = 1;
  const document = await pdf("example.pdf", { scale: 3 });
  for await (const image of document) {
    await fs.writeFile(`page${counter}.png`, image);
    counter++;
  }
}
main();
```

Using jest and [jest-image-snapshot](https://npm.im/jest-image-snapshot):

```js
const { pdf } = require("pdf-to-img");

it("generates a PDF", async () => {
  for await (const page of await pdf("example.pdf")) {
    expect(page).toMatchImageSnapshot();
  }
});

// or if you want access to more details:

it("generates a PDF with 2 pages", async () => {
  const doc = await pdf("example.pdf");

  expect(doc.length).toBe(2);
  expect(doc.metadata).toEqual({ ... });

  for await (const page of doc) {
    expect(page).toMatchImageSnapshot();
  }
});

```

The `pdf` function accepts either a path to the file on disk, or a data URL (e.g. `data:application/pdf;base64,...`)

### Options

You can supply a second argument which is an object of options:

```js
const doc = await pdf("example.pdf", {
  password: "...", // if the PDF is encrypted

  scale: 2.0, // use this for PDFs with high resolution images if the generated image is low quality
});
```

## CLI

```sh
npm i -g pdf-to-img@latest

# example:
pdf2img inputFile.pdf

# options:
# -s / --scale: set the scale (defaults to 3)
# -p / --password: the password to unlock the PDF
# -o / --output: the output folder, relative to the current working directory.
```
