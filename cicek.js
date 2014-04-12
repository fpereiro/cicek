/*
cicek - v1.0.0

Written by Federico Pereiro (fpereiro@gmail.com) and released into the public domain.

Please refer to README.md to see what this is about.
*/

(function () {

   // *** SETUP ***

   log = console.log;

   var fs = require ('fs');

   // We require the node-mime library.
   var mime = require ('mime');

   // We check for dale and teishi.
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

   // A cicek head is either a single number (an http status code) or an array with two elements. If it is an array, the first element is the status code. The second element is an object with response headers.
   cicek.v.head = function (head) {
      if (teishi.stop ({
         compare: head,
         to: ['number', 'array'],
         test: teishi.test.type,
         multi: 'one_of',
         label: 'cicek head'
      })) return false;

      if (teishi.type (head) === 'number') {
         return (! teishi.stop ({
            compare: head,
            to: dale.do (cicek.constants.HTTP_status_codes, function (v) {return v [0]}),
            multi: 'one_of',
            label: 'cicek head HTTP status code'
         }));
      }

      return (! teishi.stop ([{
         compare: head.length,
         to: 2,
         label: 'cicek head'
      }, {
         compare: head [0],
         to: dale.do (cicek.constants.HTTP_status_codes, function (v) {return v [0]}),
         multi: 'one_of',
         label: 'cicek head HTTP status code'
      }, {
         compare: head [1],
         to: 'object',
         test: teishi.test.type,
         label: 'cicek head response headers'
      }, {
         compare: dale.do (head [1], function (v, k) {return k.toLowerCase ()}),
         to: cicek.constants.HTTP_response_headers,
         multi: 'each_of',
         label: 'HTTP response headers'
      }]));
   }

   /*
      route_object is an object containing all the routes for the server.

      The keys of the topmost level must be lowercased valid http verbs (get, post, put, etc.).

      Each specified http verb contains an object.

      That object should always contain a 'default' key.

      Every key within those objects point either to
      1) A function which receives the request and the response.
      2) An array with two elements, the first being the aforementioned function and the second being an array of arguments which will be concatenated to an array with the request and response and applied to the function.
   */

   cicek.v.route_object = function (route_object) {
      if (teishi.stop ([{
         compare: route_object,
         to: 'object',
         test: teishi.test.type,
         label: 'cicek route object'
      }, {
         compare: dale.do (route_object, function (v, k) {return k}),
         to: cicek.constants.HTTP_verbs,
         multi: 'each_of',
         label: 'cicek route method'
      }, {
         compare: route_object,
         to: 'object',
         multi: 'each',
         test: teishi.test.type,
         label: 'cicek route method'
      }, {
         compare: route_object,
         multi: 'each',
         test: function (compare, to, label, label_to, label_of) {
            if (compare.default !== undefined) return true;
            else return ['Each cicek route method', 'must have a default value that is not undefined', 'but instead cicek route method is', compare];
         }
      }, {
         compare: dale.do (route_object, function (v) {return v}),
         multi: 'each',
         test: function (compare, to, label, label_to, label_of) {
            if (teishi.type (compare) === 'function') return true;
            if (teishi.type (compare) !== 'array') {
               return ['Each cicek route entry must be either an array or a function, but instead is', compare, 'with type', teishi.type (compare)];
            }
            if (compare.length !== 2 || teishi.type (compare [0]) !== 'function' || teishi.type (compare [1]) !== 'array') {
               return ['If the cicek route entry is an array, it has to have length 2 and contain a function and an array of arguments, but instead is', compare];
            }
            else return true;
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
      if (response.readable === true && response.writable === true) return true;
      else {
         log ('Response must be a readable and writable stream.');
         return false;
      }
   }

   // *** HELPER FUNCTIONS ***

   // These helper functions take two arguments, a response plus some other argument, and are usually called by route functions (written below).

   // cicek.head is the function we use for writing the head of a response. It validates the response and head, and then writes the head to the response. If any input is invalid, it returns false without writing the head.
   cicek.head = function (response, head) {
      if (cicek.v.response (response) === false) return false;
      if (cicek.v.head (head)) return false;
      response.writeHead (head [0], head [1]);
   }

   // cicek.end is the function we use for writing the body of a response and then ending it. It receives a response and a body. The body is stringified if it's not a string, and then it is written to the response, after which the response is ended.
   cicek.end = function (response, body) {
      if (cicek.v.response (response) === false) return false;
      if (teishi.type (body) !== 'string') body = teishi.s (body);
      response.end (body);
   }

   // cicek.wJSON (short for "write JSON") receives a response and a JSON. If both are valid, it writes the JSON into the response with the proper header, otherwise returns false.
   cicek.wJSON = function (response, JSON) {
      if (cicek.v.response (response) && (teishi.s (JSON) !== false) !== true) return false;
      cicek.head ([200, {'Content-Type': 'application/json'}]);
      cicek.end (JSON);
   }

   // cicek.wHTML (short for "write HTML") receives a response and a string with HTML. If both are valid, it writes the HTML into the response with the proper header, otherwise returns false.
   cicek.wHTML = function (response, HTML) {
      if (cicek.v.response (response) && (teishi.type (HTML) === 'string') !== true) return false;
      cicek.head ([200, {'Content-Type': 'text/html'}]);
      cicek.end (HTML);
   }

   // *** ROUTE FUNCTIONS ***

   // Route functions take three arguments, a request, a response and some other argument. They are specified in route entries are are usually invoked by cicek.router (explained below).

   /*
       cicek.parse receives a request, a response and a callback. It gathers the data chunks into a string and then calls the callback, passing it the response and the string with the data.
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
      cicek.rJSON (short for "read JSON") is a function that receives a request, a response, and a callback. It invokes cicek.parse and expects a JSON within the requst.

      If the parse is unsuccessful, it sends a 400 code, together with the error "Expecting JSON, but instead received" + contents of the body.
      If the parse is successful, it passes the response and the parsed JSON to the callback.

      This is the function that you want to use if you're expecting a JSON from a post request.
   */

   cicek.rJSON = function (request, response, callback) {
      if (cicek.v.request (request) && cicek.v.response (response) && (teishi.type (callback) === 'function') !== true) return false;
      cicek.parse (request, response, function (response, string) {
         if (teishi.p (string) === false) {
            cicek.head (400);
            cicek.end ('Expecting JSON, but instead received ' + string);
         }
         else {
            callback (response, teishi.p (string));
         }
      });
   }

   /*
      XXX explain paths, file not found
   */

   cicek.file = function (request, response, paths) {
      // validate
      if (paths === undefined) {
         paths = [''];
      }
      var file_found = dale.stop_on (paths, true, function (v) {
         if (fs.existsSync (v + request.url)) {
            cicek.head ([200, {'Content-Type': mime.lookup (v + request.url)}]);
            fs.createReadStream (v + request.url).pipe (response);
            return true;
         }
      });

      if (! file_found) {
         cicek.head (404);
         cicek.end ();
      }
   }

   // *** ROUTER ***

   /*
      cicek.router is the main function. It receives a request, a response and a route_object. If any of these is invalid, the function returns false.
   */
   cicek.router = function (request, response, route_object) {

      // Validation of the inputs.
      if (cicek.v.request (request) && cicek.v.response (response) && cicek.v.route_object (route_object) !== true) return false;

      // We decode the url.
      request.url = decodeURIComponent (request.url);

      // Remove first and last slash.
      request.url = request.url.replace (/^\//, '').replace (/\/$/, '');

      // Convert request method to lowercase.
      request.method = request.method.toLowerCase ();

      // If the http verb contained in the request is not in the route_object, we return a 405 code and a list of supported methods.
      if (route_object [request.method] === undefined) {
         cicek.head ([405, {'Allow': dale.do (route_object, function (v, k) {return k}).join (', ')}]);
         cicek.end ();
         return;
      }

      // We check that the request headers are valid.
      var request_header_test = teishi.stop ({
         compare: dale.do (request.headers, function (v, k) {return k}),
         to: cicek.constants.HTTP_request_headers,
         multi: 'each_of',
         label: 'HTTP request headers'
      }, true);

      // If they are not, we return a 400 code.
      if (request_header_test [0] === true) {
         cicek.head (400);
         cicek.end (request_header_test [1]);
         return;
      }

      // We now find the current_route.
      var current_route = route_object [request.method] [request.url];

      // If the current_route is not found, we a) try to find matching wildcards, and failing that, b) we assign the current_route to the default key.
      if (current_route === undefined) {
         // We test the wildcards.
         dale.stop_on (route_object [request.method], true, function (v, k) {
            var regex = new RegExp ('^' + k.replace (/\*/g, '.+') + '$');
            if (request.url.match (regex) !== null) {
               current_route = v;
               return true;
            }
         });
         // If after testing for wildcards we still haven't found a route, we assign the default route to this request.
         current_route === undefined ? current_route = route_object [request.method].default : '';
      }

      if (teishi.type (current_route) === 'function') current_route (request, response);
      else current_route [0].apply (current_route [0], [request, response].concat (current_route [1]));
   }

}).call (this);
