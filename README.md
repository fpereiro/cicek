# çiçek

> "The conventional approach, enforced to a greater or lesser extent, is that you shall use a standard subroutine. I say that you should write your own subroutines." -- Chuck Moore

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
var cicek = require ('cicek');

cicek.listen (8000, {
   'get': {
      'main': [cicek.sHTML, '<html><h1>Welcome!</h1></html>'],
      'upload': [cicek.sHTML, '<html><form action="upload" method="post" enctype="multipart/form-data"><input type="file" name="file"><input type="submit" value="Upload file"></form></html>'],
      'images/*': cicek.sFile,
      'data': [cicek.sJSON, ['much', 'data', 'for', 'you!']],
      default: [cicek.sHTML, '<html><h1>Page not found!</h1></html>']
   },
   'post': {
      upload: [cicek.rFile, {
         uploadDir: '/home/ubuntu/files',
         hash: 'md5'
      }, function (response, error, fields, files) {
         if (error) cicek.head (response, 400);
         else cicek.head (response, 200);
         cicek.body (response, '<html><p>Error: ' + error + '<br>Fields: ' + JSON.stringify (fields) + '<br>Files:' + JSON.stringify (files));
         response.end ();
      }],
      default: [cicek.rJSON, function (response, json) {
         cicek.end (response, 200, 'You just posted: ' + JSON.stringify (json));
      }]
   }
});
```

The code above does the following:

- Create a HTTP server listening on port 8000.
- If the server receives a GET request pointing to the path `main`, it serves a welcome page.
- If the server receives a GET request pointing to the path `upload`, it serves a page where you can upload a file.
- If the server receives a GET request pointing to the path `data`, it will send a JSON.
- If the server receives a GET request with a path of the form `images/*`, it serves the corresponding image.
- If the server receives a GET with any other path than those matching the above patterns, it returns a hello world page.
- If the server receives a POST request to the path `upload`, and the POST request contains files, it writes those files to the folder `/home/ubuntu/files`.
- If the server receives a POST request that has any other path, it tries to parse it as a JSON. If it is a valid JSON, the server will echo it. If it is not a valid JSON, the server will respond with a 400 error code and an error message.

## Installation

`npm install cicek`

## çiçek routes

Routes are passed to çiçek through a `route object`.

A `route object` is an object that must follow these rules:

- Every top-level key in the object must be a valid, lowercased HTTP verb (such as `get`, `post`, `put`, etc.).
- Each of these top-level keys must have as value another object, which we'll call a `verb object`.
- Every `verb object` is an object where each key is a `path`, and the value is a `route`.
- A `path` is merely a string which is interpreted as a path. The string can contain `*`, which are interpreted as wildcards. For example, `*.js` will match `server.js` and `client.js`.
- A `route` is either a `route function` or an array where the first element is a `route function` and the remaining elements are arguments that you want to pass to the `route function`.
- Each `verb object` must contain a `default` route, which is the route that will be served if the `request.url` doesn't match any of the paths in the corresponding `verb object`. This means that if you plan to use a `default` path, it will be treated as the fallback route for any path that isn't matched, too.

## çiçek route functions

A `route function` is a function that:

- Receives a `request` and a `response` as first and second argument, always.
- Can receive further arguments if the route that invoked it was an array with more than one argument. Example: in `default: [cicek.sHTML, '<html><h1>Hello world!</h1></html>']`, `cicek.sHTML` is executed with the `request` as first argument, the `response` as the second argument, and the HTML string as the third.
- Must serve the `response`.

çiçek provides you with six `route functions`. Remember that each of these receive a `request` and a `response`, and then further optional arguments. In each of them, if the `request` or `response` are invalid, the function will return `false`.

Please remember that you can define your own `route functions`!

### `cicek.sHTML`

This function sends HTML. It receives an HTML string as its third argument.

If the HTML argument is not a string, it sends a 500 code and an error message. If it's a string, it is served as HTML, with the proper `Content-Type`.

Notice that the HTML string is not validated as proper HTML, so you can send malformed HTML and çiçek won't complain.

If the function is invoked with a valid `request` and `response`, `cicek.sHTML` will end the `response`.

### `cicek.receive`

This function receives chunked data, usually from a POST request. It receives a callback function as its third argument.

If the callback is not a function, `false` is returned. The function gets every chunk of data sent by the `request`, collects them in a string, and then passes this string to the callback function when the `request` is ended.

If there is an error in the `request`, a 400 code will be sent, together with an error message. In this case, the callback will not be called, and the `response` will be ended.

### `cicek.rJSON`

This function receives a JSON, usually from a POST `request`. It receives a callback function as its third argument. If the callback is not a function, false is returned.

The function invokes cicek.parse. When the `request` is ended and cicek.rJSON receives the output from cicek.parse, this output is parsed into a JSON. If the parsed JSON turns out to be valid, it is passed to the callback function. Otherwise, a code 400 is sent, together with an error message.

### `cicek.sJSON`

This function sends a JSON. It takes a JSON as its third argument.

If the JSON is invalid, the function sends a code 500 and an error message.

If the JSON is valid, it is stringified and written to the `response` with the appropriate mime type.

If the function is invoked with a valid `request` and `response`, `cicek.sJSON` will end the `response`.

### `cicek.sFile`

This function serves a file. It takes a `paths` argument, which can be either a string or an array of strings, each of which must be a path. Also, `paths` can be `undefined`, in which case it will be converted into an empty string.

The function then attempts to find the path specified in the `request` in each of the paths within `path`. For example, if the `request.url` is `client.js` and one of the `paths` is `lib/`, if `lib/client.js` exists, that file will be served with a 200 code.

Each file is served with its appropriate mime type, thanks to the mime library.

If every path is tried and the file is not found, a 404 code is sent.

If `options.uploadDir` is specified and the directory does not exist, a 500 error is sent.

If the function is invoked with a valid `request` and `response`, `cicek.sFile` will end the `response`.

### `cicek.rFile`

This function receives file uploads. It is a wrapper for formidable's file parsing.

It receives an options object as its third argument, where each key is a valid formidable option, and a callback as its fourth argument. If any of these is invalid, the function sends a 500 code and an error message.

If all the arguments are valid, formidable is invoked and then the output of it is passed to the callback function.

The callback function receives four arguments: 1) the response, 2) the error, 3) an argument named fields, containing JSON data that is submitted along with the `request`, and 4) an argument named files, which contains information about the files uploaded. For more information about how these work, consult formidable's documentation.

## Helper functions

Most `route functions` will invoke helper functions to do certain actions. The main helper functions are four: `cicek.head`, `cicek.body`, `cicek.end` and `cicek.rCookie`.

### `cicek.head`

`cicek.head` receives two arguments, a `response` and a `head`. If any of these are invalid, the function will return `false`.

A `head` is either a valid HTTP status code (e.g.: 200) or an array which exactly two elements, the first of which is an HTTP status code and the second is an object where every key is a valid HTTP response header (e.g.: {'Content-Type': 'application/json'}).

This function writes the head of a `response`.

A third argument (`verbose`) can be passed to this function. If `verbose` is equal to `true`, the function will log to the console the `head`, using pretty colors. Note that `verbose` can be set to `true` only on a given call to `cicek.head`, not globally.

### `cicek.body`

Same as `cicek.head` but for writing the body of a `request`. It receives a `response` and a body. If the `response` is invalid, the function returns `false`.

- If the body is a string, it is not touched.
- If the body is undefined, it is set to an empty string.
- If the body is neither a string nor undefined, it is stringified; this means that if the body is a valid array or object, it will be stringified.

The body is written to the `response`. Note that the `response` is not ended.

### `cicek.end`

This function is a wrapper for both `cicek.head` and `cicek.body`. It takes a `response`, a head, a body and an optional `verbose` argument. If any of these are invalid, it returns false.

The function invokes `cicek.head` and `cicek.body`, passing the appropriate parameters. Then, it ends the `response`.

### `cicek.rCookie`

This function receives a `request` and a string. If either it false, it returns false.

If the `request` has no defined cookie, the function returns false.

If the `request` has a cookie, it tries to match the string received as a key of the cookie.

For example, if the `request` cookie is `'key1=value1;key2=value2'`, and you invoke `rCookie (request, 'key2')`, the function will output `'value2'`.

## `cicek.listen`

This function is the one you invoke to start using çiçek. It takes two arguments: a port number (an integer between 1 and 65535)  and a `route object`. If either is invalid, the function returns false.

If the inputs were valid, `cicek.listen` will start a node HTTP server. This server will only invoke `cicek.router` every time it receives a `request`, passing it the `request`, the `response` and the `route object`.

When çiçek starts listening, it informs it through the console.

## `cicek.router`

You don't need to know how the router works, but let's see what it does anyhow:

- As we just said, it takes a `request`, a `response` and a `route object`. If any of these is invalid, it returns false.
- It percent-decodes the `request.url`.
- If `request.url` starts with a slash, it removes this slash. If the url finishes with a slash, it removes this slash as well. If the url is '/', it will be left as is.
- The `request.method` is converted to lowercase.
- If the `request.method` is not defined in the `route object` received by the function, the function sends a 405 code, plus a list of supported methods.
- The function validates the `request` headers. If any of these is invalid, it sends a 400 code, plus an error message.
- The function tries to find a valid route. It will first match literal routes, then wildcards. The wildcarded routes are matched in the order that they appear in the `route object`.
- If not, then the `default` route of the method will be selected.
- If the selected route is a function, it is invoked with the `request` and `response`.
- If the selected route is an array, the first argument of the array (which is the `route function`) is invoked with the `request` and `response`, plus the rest of the elements of the array as its arguments.

## Source code

The complete source code is contained in `cicek.js`. It is about 550 lines long.

## License

çiçek is written by Federico Pereiro (fpereiro@gmail.com) and released into the public domain.
