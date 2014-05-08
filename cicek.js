/*
çiçek - v0.3.2

Written by Federico Pereiro (fpereiro@gmail.com) and released into the public domain.

Please refer to README.md to see what this is about.
*/

(function () {

   // *** SETUP ***

   // Useful shorthand.
   var log = console.log;

   // Require native dependencies.
   var fs = require ('fs');
   var http = require ('http');

   // Require the node-mime library.
   var mime = require ('mime');

   // Require formidable.
   var formidable = require ('formidable');

   // Require dale and teishi.
   var dale = require ('dale');
   var teishi = require ('teishi');

   var cicek = exports;

   // *** CONSTANTS ***

   cicek.constants = {};

   // Taken from http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html
   cicek.constants.HTTP_verbs = ['get', 'head', 'post', 'put', 'delete', 'trace', 'connect'];

   // Taken from http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html
   cicek.constants.HTTP_status_codes = [
      [100, 'Continue'],
      [101, 'Switching Protocols'],
      [200, 'OK'],
      [201, 'Created'],
      [202, 'Accepted'],
      [203, 'Non-Authoritative Information'],
      [204, 'No Content'],
      [205, 'Reset Content'],
      [206, 'Partial Content'],
      [300, 'Multiple Choices'],
      [301, 'Moved Permanently'],
      [302, 'Found'],
      [303, 'See Other'],
      [304, 'Not Modified'],
      [305, 'Use Proxy'],
      [307, 'Temporary Redirect'],
      [400, 'Bad Request'],
      [401, 'Unauthorized'],
      [402, 'Payment Required'],
      [403, 'Forbidden'],
      [404, 'Not Found'],
      [405, 'Method Not Allowed'],
      [406, 'Not Acceptable'],
      [407, 'Proxy Authentication Required'],
      [408, 'Request Timeout'],
      [409, 'Conflict'],
      [410, 'Gone'],
      [411, 'Length Required'],
      [412, 'Precondition Failed'],
      [413, 'Request Entity Too Large'],
      [414, 'Request-URI Too Long'],
      [415, 'Unsupported Media Type'],
      [416, 'Requested Range Not Satisfiable'],
      [417, 'Expectation Failed'],
      [500, 'Internal Server Error'],
      [501, 'Not Implemented'],
      [502, 'Bad Gateway'],
      [503, 'Service Unavailable'],
      [504, 'Gateway Timeout'],
      [505, 'HTTP Version Not Supported'],
   ];

   // http://en.wikipedia.org/wiki/List_of_HTTP_header_fields
   cicek.constants.HTTP_request_headers = ['accept', 'accept-charset', 'accept-encoding', 'accept-language', 'accept-datetime', 'authorization', 'cache-control', 'connection', 'cookie', 'content-length', 'content-md5', 'content-type', 'date', 'expect', 'from', 'host', 'if-match', 'if-modified-since', 'if-none-match', 'if-range', 'if-unmodified-since', 'max-forwards', 'origin', 'pragma', 'proxy-authorization', 'range', 'referer', 'te', 'user-agent', 'via', 'warning', 'x-requested-with', 'dnt', 'x-forwarded-for', 'x-forwarded-for:', 'x-forwarded-proto', 'front-end-https', 'x-att-deviceid', 'x-wap-profile', 'proxy-connection'];

   // http://en.wikipedia.org/wiki/List_of_HTTP_header_fields
   cicek.constants.HTTP_response_headers = ['access-control-allow-origin', 'accept-ranges', 'age', 'allow', 'cache-control', 'connection', 'content-encoding', 'content-language', 'content-length', 'content-location', 'content-md5', 'content-disposition', 'content-range', 'content-type', 'date', 'etag', 'expires', 'last-modified', 'link', 'location', 'p3p', 'pragma', 'proxy-authenticate', 'refresh', 'retry-after', 'server', 'set-cookie', 'status', 'strict-transport-security', 'trailer', 'transfer-encoding', 'upgrade', 'vary', 'via', 'warning', 'www-authenticate', 'x-frame-options', 'x-xss-protection', 'content-security-policy,', 'x-content-security-policy', 'x-webkit-csp', 'x-content-type-options', 'x-powered-by', 'x-ua-compatible'];

   // *** VALIDATION ***

   cicek.v = {};

   // A çiçek head is either a single number (an http status code) or an array with two elements. If it is an array, the first element is the status code. The second element is an object with response headers.
   cicek.v.head = function (head) {
      if (teishi.stop ({
         compare: head,
         to: ['number', 'array'],
         test: teishi.test.type,
         multi: 'one_of',
         label: 'çiçek head'
      })) return false;

      if (teishi.type (head) === 'number') {
         return (! teishi.stop ({
            compare: head,
            to: dale.do (cicek.constants.HTTP_status_codes, function (v) {return v [0]}),
            multi: 'one_of',
            label: 'çiçek head HTTP status code'
         }));
      }

      return (! teishi.stop ([{
         compare: head.length,
         to: 2,
         label: 'çiçek head'
      }, {
         compare: head [0],
         to: dale.do (cicek.constants.HTTP_status_codes, function (v) {return v [0]}),
         multi: 'one_of',
         label: 'çiçek head HTTP status code'
      }, {
         compare: head [1],
         to: 'object',
         test: teishi.test.type,
         label: 'çiçek head response headers'
      }, {
         compare: dale.do (head [1], function (v, k) {return k.toLowerCase ()}),
         to: cicek.constants.HTTP_response_headers,
         multi: 'each_of',
         label: 'HTTP response headers'
      }]));
   }

   /*
      routes is an object containing all the routes for the server.

      The keys of the topmost level must be lowercased valid http verbs (get, post, put, etc.).

      Each specified http verb contains an object.

      That object should always contain a 'default' key.

      Every key within those objects point either to
      1) A function which receives the request and the response.
      2) An array with two elements, the first being the aforementioned function and the second being an array of arguments which will be concatenated to an array with the request and response and applied to the function.
   */

   cicek.v.routes = function (routes) {
      if (teishi.stop ([{
         compare: routes,
         to: 'object',
         test: teishi.test.type,
         label: 'çiçek route object'
      }, {
         compare: dale.do (routes, function (v, k) {return k}),
         to: cicek.constants.HTTP_verbs,
         multi: 'each_of',
         label: 'çiçek route method'
      }, {
         compare: routes,
         to: 'object',
         multi: 'each',
         test: teishi.test.type,
         label: 'çiçek route method'
      }, {
         compare: routes,
         multi: 'each',
         test: function (compare, to, label, label_to, label_of) {
            if (compare.default !== undefined) return true;
            else return ['Each çiçek route method', 'must have a default value that is not undefined', 'but instead çiçek route method is', compare];
         }
      }, {
         compare: routes,
         multi: 'each',
         test: function (compare, to, label, label_to, label_of) {
            return dale.stop_on (compare, false, function (v) {
               if (teishi.stop ({
                  compare: v,
                  to: ['function', 'array'],
                  test: teishi.test.type,
                  multi: 'one_of',
                  label: 'çiçek route function'
               })) return false;
               if (teishi.type (v) === 'array') {
                  if (teishi.stop ([{
                     compare: v [0],
                     to: 'function',
                     test: teishi.test.type,
                     label: 'çiçek route function'
                  }, {
                     compare: v [1] === undefined,
                     to: false,
                     label: 'çiçek route argument must not be undefined'
                  }])) return false;
               }
               return true;
            });
         }
      }])) return false;
      return true;
   }

   // A request is always a readable stream that is not writable.
   cicek.v.request = function (request) {
      if (request.readable === true && request.writable === undefined) return true;
      else {
         log ('Request must be a readable (and not writable) stream.');
         return false;
      }
   }

   // A request is always a readable and writable stream.
   cicek.v.response = function (response) {
      if (response.connection && response.connection.readable && response.connection.writable) return true;
      else {
         log ('Response must be a readable and writable stream.');
         return false;
      }
   }

   // *** HELPER FUNCTIONS ***

   // Taken from http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
   // This function escapes a string so that it can be used in the body of a regex. We'll use this both in çiçek.rCookie and in çiçek.router to match wildcards.
   // Notice that this function won't escape the '*' sign, since we want to support wildcards.
   cicek.escapeRegex = function (string) {
      if (teishi.type (string) !== 'string') return false;
      return string.replace (/[\-\[\]\/\{\}\(\)\+\?\.\\\^\$\|]/g, "\\$&");
   }

   // We don't validate because this function is called only from cicek.head and only after the status code in the head is validated.
   cicek.find_HTTP_status_code_description = function (HTTP_status_code) {
      var description;
      dale.stop_on (cicek.constants.HTTP_status_codes, true, function (v) {
         if (v [0] === HTTP_status_code) {
            description = v [1];
            return true;
         }
      });
      return description;
   }

   // çiçek.head is the function used for writing the head of a response. It validates the response and head, and then writes the head to the response. If any input is invalid, it returns false without writing the head.
   cicek.head = function (response, head, verbose) {
      if (cicek.v.response (response) === false) return false;
      if (cicek.v.head (head) === false) return false;

      if (teishi.type (head) === 'number') response.writeHead (head);
      else                                 response.writeHead (head [0], head [1]);

      if (verbose === true) {
         var c = {1: 6, 2: 2, 3: 4, 4: 3, 5: 1};
         var f = function (h) {return '\033[3' + c [(h + '').substr (0, 1)] + 'm' + h + '\033[0m'}
         log ('çiçek wrote head with status code', isNaN (head) ? f (head [0]) : f (head), '(' + cicek.find_HTTP_status_code_description (isNaN (head) ? head [0] : head) + ')', isNaN (head) ? 'and headers ' + teishi.s (head [1]) : '');
      }
   }

   // çiçek.body receives a response and a body. It validates the response it receives. If the body is undefined, it is set to an empty string. If it's not a string, it is stringified. After this, it is
   cicek.body = function (response, body) {
      if (cicek.v.response (response) === false) return false;
      if (body === undefined) body = '';
      if (teishi.type (body) !== 'string') body = teishi.s (body);
      if (body === false) body = body + '';
      response.write (body);
   }

   // çiçek.end is the function used for ending a response. It takes a head and a body, passes the first to çiçek.head and the second to çiçek.body.
   cicek.end = function (response, head, body, verbose) {
      if (cicek.head (response, head, verbose) === false || cicek.body (response, body) === false) {
         return false;
      }
      response.end ();
   }

   // çiçek.rCookie takes a request and a string. If any of these inputs is invalid, it returns false. If a cookie is found that matches the string, the value of the cookie is returned. If not, false is returned.

   cicek.rCookie = function (request, string) {
      if ((cicek.v.request (request) && teishi.type (string) === 'string') === false) return false;
      var cookie = false;
      if (request.headers.cookie) {
         dale.stop_on (request.headers.cookie.split (';'), true, function (v) {
                                                                        // Notice we escape '*' too, because we want to treat it literally.
            var regex = new RegExp ('^\\s*' + cicek.escapeRegex (string).replace ('*', '\\*') + '=');
            if (v.match (regex) !== null) {
               cookie = v.replace (regex, '');
               return true;
            }
         });
      }
      return cookie;
   }

   // *** ROUTE FUNCTIONS ***

   // çiçek.wJSON (short for "write JSON") receives a response and a JSON. If both are valid, it writes the JSON into the response with the proper header, otherwise returns false.
   cicek.wJSON = function (request, response, JSON) {
      // We don't validate the request since we don't use it! We place it as a parameter just because we want to invoke çiçek.wJSON directly from a çiçek route, and the router always passes request and response.
      if (cicek.v.response (response) === false) return false;
      if (teishi.s (JSON) === false) {
         cicek.end (response, 500, 'Server generated invalid JSON.');
      }
      else {
         cicek.end (response, [200, {'Content-Type': 'application/json'}], JSON);
      }
   }

   // çiçek.wHTML (short for "write HTML") receives a response and a string with HTML. If both are valid, it writes the HTML into the response with the proper header, otherwise returns false.
   cicek.wHTML = function (request, response, HTML) {
      // We don't validate the request since we don't use it! We place it as a parameter just because we want to invoke çiçek.wJSON directly from a çiçek route, and the router always passes request and response.
      if (cicek.v.response (response) === false) return false;
      if (teishi.type (HTML) !== 'string') {
         cicek.end (response, [500, 'Server tried to serve invalid HTML string.']);
      }
      else cicek.end (response, [200, {'Content-Type': 'text/html'}], HTML);
   }

   /*
       çiçek.parse receives a request, a response and a callback. It gathers the data chunks into a string and then calls the callback, passing it the response and the string with the data.
   */
   cicek.parse = function (request, response, callback) {
      if (cicek.v.request (request) && cicek.v.response (response) && (teishi.type (callback) === 'function') !== true) return false;
      var data = '';
      request.on ('data', function (incoming_data) {
         data += incoming_data;
      });
      request.on ('end', function () {
         callback (response, data);
      });
   }

   /*
      çiçek.rJSON (short for "read JSON") is a function that receives a request, a response, and a callback. It invokes çiçek.parse and expects a JSON within the requst.

      If the parse is unsuccessful, it sends a 400 code, together with the error "Expecting JSON, but instead received" + contents of the body.
      If the parse is successful, it passes the response and the parsed JSON to the callback.

      This is the function that you want to use if you're expecting a JSON from a post request.
   */

   cicek.rJSON = function (request, response, callback) {
      if ((cicek.v.request (request) && cicek.v.response (response) && (teishi.type (callback) === 'function')) !== true) return false;
      cicek.parse (request, response, function (response, string) {
         if (teishi.p (string) === false) {
            cicek.end (response, 400, 'Expecting JSON, but instead received ' + string);
         }
         else {
            callback (response, teishi.p (string));
         }
      });
   }

   /*
      This function validates its inputs. The paths arguments can be either a string or an array of strings, each of which is a path. The function then attempts to find request.path in each of the folders specified by the paths argument. When the first file is found, that file is served, hence the order of the paths may be important. Each file is served with its appropriate mime type, thanks to the mime library. If every path is tried and the file is not found, a 404 code is sent.
   */

   cicek.rFile = function (request, response, paths) {

      if (paths === undefined) paths = '';
      if (teishi.type (paths) === 'string') paths = [paths];

      if (teishi.stop ([{
         compare: paths,
         to: 'array',
         test: teishi.test.type,
         label: 'paths passed to çiçek.file'
      }, {
         compare: paths,
         to: 'string',
         test: teishi.test.type,
         multi: 'each',
         label: 'each path passed to çiçek.file'
      }])) return false;

      var file_found = dale.stop_on (paths, true, function (v) {
         if (fs.existsSync (v + request.url)) {
            cicek.head (response, [200, {'Content-Type': mime.lookup (v + request.url)}]);
            fs.createReadStream (v + request.url).pipe (response);
            return true;
         }
      });
      if (! file_found) {
         cicek.end (response, 404);
      }
   }

   // This function is a wrapper around formidable. It validates inputs and if they are valid it passes them to formidable.

   cicek.wFile = function (request, response, options, callback) {
      if ((cicek.v.request (request) && cicek.v.response (response)) !== true) return false;
      if (teishi.stop ([{
         compare: callback,
         to: 'function',
         test: teishi.test.type,
         label: 'Callback argument passed to çiçek.wFile'
      }, {
         compare: options,
         to: ['object', 'undefined'],
         test: teishi.test.type,
         multi: 'one_of',
         label: 'Options argument passed to çiçek.wFile'
      }])) return cicek.end (response, 500);
      if (options !== undefined) {
         if (teishi.stop ([{
            compare: dale.do (options, function (v, k) {return k}),
            to: ['encoding', 'uploadDir', 'keepExtensions', 'type', 'maxFieldsSize', 'maxFields', 'hash', 'multiples'],
            multi: 'each_of',
            label: 'Keys of options argument passed to çiçek.wFile'
         }, {
            compare: options.encoding,
            to: ['string', 'undefined'],
            test: teishi.test.type,
            multi: 'one_of',
            label: 'options.encoding passed to çiçek.wFile'
         }, {
            compare: options.uploadDir,
            to: ['string', 'undefined'],
            test: teishi.test.type,
            multi: 'one_of',
            label: 'options.uploadDir passed to çiçek.wFile'
         }, {
            compare: options.keepExtensions,
            to: ['boolean', 'undefined'],
            test: teishi.test.type,
            multi: 'one_of',
            label: 'options.keepExtensions passed to çiçek.wFile'
         }, {
            compare: options.type,
            to: [undefined, 'multipart', 'urlencoded'],
            multi: 'one_of',
            label: 'options.type passed to çiçek.wFile'
         }, {
            compare: options.maxFieldsSize,
            to: ['number', 'undefined'],
            test: teishi.test.type,
            multi: 'one_of',
            label: 'options.maxFieldsSize passed to çiçek.wFile'
         }, {
            compare: options.maxFields,
            to: ['number', 'undefined'],
            test: teishi.test.type,
            multi: 'one_of',
            label: 'options.maxFieldsSize passed to çiçek.wFile'
         }, {
            compare: options.hash,
            to: [undefined, 'sha1', 'md5'],
            multi: 'one_of',
            label: 'options.path passed to çiçek.wFile'
         }, {
            compare: options.multiples,
            to: ['boolean', 'undefined'],
            test: teishi.test.type,
            multi: 'one_of',
            label: 'options.maxFieldsSize passed to çiçek.wFile'
         }])) return cicek.end (response, 500);
      }

      var form = new formidable.IncomingForm ();

      // We apply the options.
      dale.do (options, function (v, k) {
         form [k] = v;
      });

      form.parse (request, function (error, fields, files) {
         callback (response, error, fields, files);
      });
   }

   // *** ROUTER ***

   /*
      çiçek.router is the main function. It receives a request, a response and a routes. If any of these is invalid, the function returns false.
   */
   cicek.router = function (request, response, routes) {

      // Validation of the inputs.
      if (cicek.v.request (request) && cicek.v.response (response) && cicek.v.routes (routes) !== true) return false;

      // Decode the url.
      request.url = decodeURIComponent (request.url);

      // Remove first and last slash.
      request.url = request.url.replace (/^\//, '').replace (/\/$/, '');

      // If the url is an empty string (because we want the root of the domain), we set it to a single slash ('/').
      if (request.url === '') request.url = '/';

      // Convert request method to lowercase.
      request.method = request.method.toLowerCase ();

      // If the http verb contained in the request is not in the routes, return a 405 code and a list of supported methods.
      if (routes [request.method] === undefined) {
         cicek.end (response, [405, {'Allow': dale.do (routes, function (v, k) {return k}).join (', ')}]);
         return;
      }

      // Check that the request headers are valid.
      var request_header_test = teishi.stop ({
         compare: dale.do (request.headers, function (v, k) {return k}),
         to: cicek.constants.HTTP_request_headers,
         multi: 'each_of',
         label: 'HTTP request headers'
      }, true);

      // If they are not, return a 400 code.
      if (request_header_test [0] === true) {
         cicek.end (response, 400, request_header_test [1]);
         return;
      }

      // Find the current_route.
      var current_route = routes [request.method] [request.url];

      // If the current_route is not found, a) try to find matching wildcards, and failing that, b) assign the current_route to the default key.
      if (current_route === undefined) {
         // Test the wildcards.
         dale.stop_on (routes [request.method], true, function (v, k) {
            var regex = new RegExp ('^' + cicek.escapeRegex (k).replace (/\*/g, '.*') + '$');
            if (request.url.match (regex) !== null) {
               current_route = v;
               return true;
            }
         });
         // If after testing for wildcards we still haven't found a route, assign the default route to this request.
         current_route === undefined ? current_route = routes [request.method].default : '';
      }
      if (teishi.type (current_route) === 'function') current_route (request, response);
      else {
         current_route [0].apply (current_route [0], [request, response].concat (current_route.slice (1, current_route.length)));
      }
   }

   cicek.listen = function (port, routes) {
      if (teishi.stop ({
         compare: port,
         to: 'number',
         test: teishi.test.type,
         label: 'Port passed to çiçek.listen'
      })) return false;

      if (port < 1 || port > 65535) {
         console.log ('Port must be in the range 1-65535');
         return false;
      }

      if (cicek.v.routes (routes) === false) return false;

      http.createServer (function (request, response) {
         cicek.router (request, response, routes);
      }).listen (port);

      // I couldn't resist doing this.
      log ('\033[1m\033[3' + Math.round ((Math.random () * 7)) + 'm' + 'Çiçek listening in port', port + '!\033[0m');
   }

}).call (this);
