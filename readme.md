# çiçek

> "The conventional approach, enforced to a greater or lesser extent, is that you shall use a standard subroutine. I say that you should write your own subroutines." -- Chuck Moore

çiçek is a web server. It is designed to be:

1. Minimalistic: çiçek is ~630 lines of code and uses only four libraries:
   * [busboy](https://github.com/mscdex/busboy), for multipart/form-data support.
   * [mime](https://github.com/broofa/node-mime), for guessing the MIME type of a file.
   * [dale](https://github.com/fpereiro/dale), for looping.
   * [teishi](https://github.com/fpereiro/teishi), for validation.
2. Self-contained: çiçek provides useful functions and defaults that allow you to write the backend of your application with minimal configuration and no extra dependencies. Here's all the things that çiçek does out of the box:
   * Parse received JSONs.
   * Parse uploaded files.
   * Set content headers.
   * Serve files.
   * Encrypt/decrypt cookies.
   * Compression.
   * Log requests to the console.
   * Validate request and response headers to make your application RFC compliant.
3. Modular: çiçek is composed of a few functions called in sequence - you can easily override or enhance these functions.

çiçek borrows both terminology and patterns from [express](https://github.com/strongloop/express).

## Documentation coming soon!

## License

çiçek is written by Federico Pereiro (fpereiro@gmail.com) and released into the public domain.
