# çiçek

> "The conventional approach, enforced to a greater or lesser extent, is that you shall use a standard subroutine. I say that you should write your own subroutines." -- Chuck Moore

**Warning: çiçek is not production ready at all and is under heavy development right now.**

**Warning 2: this readme is extremely crude. Right now, it's written for the purposes of letting me understanding the library while i develop it. Please don't try too hard reading this because it won't be worth it.**

çiçek is a web server. It was written with the following purposes:

1. To have validation and error checking everywhere (from routes to request headers).
2. To write routes as object literals.
3. To make the web server layer contain only the functions that I use over and over, nothing else.
4. To have as few dependencies as possible. çiçek uses only four libraries:
   * The amazing [formidable](https://github.com/felixge/node-formidable), for file uploads.
   * [mime](https://github.com/broofa/node-mime), for guessing the MIME type.
   * [dale](https://github.com/fpereiro/dale), for looping.
   * [teishi](https://github.com/fpereiro/teishi), for validation.

## Example usage

```javascript
cicek.listen (8000, {
   'get': {
      'lib/*.js': cicek.rFile,
      'images/*': cicek.rFile,
      default: [cicek.wHTML, '<html><h1>Hello world!</h1></html>']
   },
   'post': {
      upload: [cicek.wFile, {
         uploadDir: '/home/ubuntu/files',
         hash: 'md5'
       }, function (response, error, fields, files) {
            console.log ('Uploaded', files ['files[]'].path);
       }],
      default: [cicek.rJSON, function (response, JSON) {
         cicek.end (response, 200, 'You just posted: ' + JSON.stringify (JSON));
      }]
   }
});
```

## Installation

`npm install cicek`

## çiçek routes

object with one key per supported HTTP verb (one for "GET", one for "POST", etc.).

A default route for each supported HTTP verb.

Wildcards match zero or more characters.

Each route can be either a `route function` or an array with the `route function` as the first element.

Each `route function` receives the request and the response as their first and second argument.

If a route is an array with more than one element, those elements are passed as arguments to the `route function` if it gets executed, after the request and the response.

Example: in `default: [cicek.wHTML, '<html><h1>Hello world!</h1></html>']`, cicek.wHTML is executed with the request as first argument, the response as the second argument, and the HTML string as the third.

## List of `route functions`

cicek.wJSON 500, 200
cicek.wHTML
cicek.parse callback
cicek.rJSON
cicek.rFile, optional paths, remember to put trailing slash in paths

## Helper functions

Usually invoked from within the `route functions`.

cicek.head, verbose option
cicek.body
cicek.end, response, head, body
cicek.rCookie

## cicek listen

it has colors!

## cicek router

## Source code

The complete source code is contained in `cicek.js`. It is about 540 lines long.

## License

çiçek is written by Federico Pereiro (fpereiro@gmail.com) and released into the public domain.
