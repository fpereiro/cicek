# çiçek

> "The conventional approach, enforced to a greater or lesser extent, is that you shall use a standard subroutine. I say that you should write your own subroutines." -- [Chuck Moore](http://www.colorforth.com/POL.htm)

çiçek is a web server built on top of node.js. It is designed to be:

1. Small: çiçek is ~800 lines of code and has only four dependencies:
   * [busboy](https://github.com/mscdex/busboy), for `multipart/form-data` support.
   * [mime](https://github.com/broofa/node-mime), for ~~guessing~~ determining the MIME type of a file.
   * [dale](https://github.com/fpereiro/dale), for looping.
   * [teishi](https://github.com/fpereiro/teishi), for validation.
2. Self-contained: çiçek provides useful functions and defaults that allow you to write the backend of a web application with minimal configuration and no extra dependencies. Here's all the things that çiçek does out of the box:
   * Parse incoming query parameters, JSONs, and multipart/form-data (files).
   * Set content headers.
   * Serve data & files.
   * Reads/writes cookies (and cryptographically signs/verifies them).
   * Cache with etags.
   * Compression.
   * Print useful output to the console.
   * Run the server on each of your cores using [cluster](https://nodejs.org/api/cluster.html).
   * Restarting the processes if one fails.
   * Writing logs with JSON format and automatic log rotation and compression.
3. Universal: çiçek tries to express the universal patterns of a web server in the simplest way that will be practical. I hope that çiçek will let you understand what an HTTP(S) server written on node.js is doing, and maybe even encourage you to [write your own](http://www.federicopereiro.com/write/).

çiçek borrows both terminology and patterns from [express](https://github.com/strongloop/express).

## Current status of the project

The current version of çiçek, v3.2.0, is considered to be *unstable* and *somewhat complete*. [Suggestions](https://github.com/fpereiro/cicek/issues) and [patches](https://github.com/fpereiro/cicek/pulls) are welcome. Future changes planned are:

- Fix bug when exceptions are thrown in cluster mode.
- Add an API reference.
- Add a tutorial.
- Add annotated source code.
- Improve initialization of config parameters.
- Add log deletion.
- Upgrade insecure requests.
- Default headers.
- Default errors.
- Add missing tests.

## Installation

`npm install cicek`

To use çiçek, you need node.js v0.8.0 or newer.

## Source code

The complete source code is contained in `cicek.js`. It is about 830 lines long.

Annotated source code will be forthcoming when the library stabilizes.

## License

çiçek is written by Federico Pereiro (fpereiro@gmail.com) and released into the public domain.
