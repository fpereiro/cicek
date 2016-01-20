/*
çiçek - v2.1.3

Written by Federico Pereiro (fpereiro@gmail.com) and released into the public domain.

Please refer to readme.md to read the annotated source.
*/

(function () {

   // *** SETUP ***

   var crypto  = require ('crypto');
   var fs      = require ('fs');
   var http    = require ('http');
   var https   = require ('https');
   var cluster = require ('cluster');
   var os      = require ('os');
   var path    = require ('path');
   var query   = require ('querystring');
   var zlib    = require ('zlib');

   var Busboy  = require ('busboy');
   var mime    = require ('mime');
   var dale    = require ('dale');
   var teishi  = require ('teishi');

   var type = teishi.t;
   var log  = teishi.l;

   var cicek = exports;

   // *** HTTP CONSTANTS ***

   cicek.http = {
      methods: ['get', 'head', 'post', 'put', 'delete', 'trace', 'connect'],
      codes:  dale.do (http.STATUS_CODES, function (v, k) {return parseInt (k)}),
      requestHeaders: new RegExp ('^(' + ['accept', 'accept-charset', 'accept-encoding', 'accept-language', 'accept-datetime', 'authorization', 'cache-control', 'connection', 'cookie', 'content-length', 'content-md5', 'content-type', 'date', 'expect', 'from', 'host', 'https', 'if-match', 'if-modified-since', 'if-none-match', 'if-range', 'if-unmodified-since', 'max-forwards', 'origin', 'pragma', 'proxy-authorization', 'range', 'referer', 'te', 'user-agent', 'upgrade', 'via', 'warning', 'dnt', 'front-end-https', 'upgrade-insecure-requests', 'x-.+'].join ('|') + ')$', 'i'),
      responseHeaders: new RegExp ('^(' + ['access-control-allow-origin', 'accept-ranges', 'age', 'allow', 'cache-control', 'connection', 'content-encoding', 'content-language', 'content-length', 'content-location', 'content-md5', 'content-disposition', 'content-range', 'content-type', 'date', 'etag', 'expires', 'last-modified', 'link', 'location', 'p3p', 'pragma', 'proxy-authenticate', 'refresh', 'retry-after', 'server', 'set-cookie', 'status', 'strict-transport-security', 'trailer', 'transfer-encoding', 'upgrade', 'vary', 'via', 'warning', 'www-authenticate', 'public-key-pins', 'content-security-policy', 'x-.+'].join ('|') + ')$', 'i')
   }

   // *** OPTIONS OBJECT ***

   cicek.options = {
      bodyLogLimit: 1024
   }

   // *** HELPER FUNCTIONS ***

   var stop = function (fun, rules) {
      return teishi.stop (fun, rules, function (error) {
         cicek.out ({error: error});
      });
   }

   cicek.out = function (message) {
      if (cicek.options.log) {
         var messageo = type (message, true) !== 'object' ? {message: message} : teishi.c (message);
         messageo.date = new Date ().toUTCString ();
         if (messageo.response && type (messageo.response.body) === 'string') messageo.response.body = messageo.response.body.slice (0, cicek.options.bodyLogLimit) + (messageo.response.body.length > cicek.options.bodyLogLimit ? '...' : '');
         if (type (cicek.options.log) === 'string') fs.appendFile (cicek.options.log, JSON.stringify (messageo) + ',\n', function (error) {
            if (error) cicek.out ({error: error});
         });
         else                                       cicek.options.log (message);
      }

      if (cicek.options.console === false)             return false;
      if (type (cicek.options.console) === 'function') cicek.console (message);
      else if (type (message) === 'object' && dale.keys (message).length === 1) {
         var what = dale.keys (message) [0];
         message = message [what];
         var date = new Date ().toUTCString ();
         if      (what === 'request')  log (date + ' REQUEST #' + message.number, 'origin: ' + message.origin, message.method.toUpperCase (), message.url, message.headers);
         else if (what === 'response') log (date + ' RESPONSE #' + message.number + ' (' + message.duration + 'ms)', message.method.toUpperCase (), message.url, '\033[37m\033[4' + {1: 6, 2: 2, 3: 4, 4: 3, 5: 1} [(message.code + '') [0]] + 'm' + message.code + '\033[0m\033[1m', message.path ? {path: message.path} : '"' + message.body.slice (0, cicek.options.bodyLogLimit) + (message.body.length > cicek.options.bodyLogLimit ? '...' : '') + '"', message.responseHeaders);
         else                          log (date + ' ' + what.toUpperCase (), message);
      }
      else log.apply (undefined, type (message) === 'array' ? message : [message]);
      return false;
   }

   cicek.escapeString = function (string, dontEscape) {
      if (stop ('çiçek.escapeString', [
         ['string', string, 'string'],
         ['dontEscape', dontEscape, ['array', 'undefined'], 'oneOf'],
         [dontEscape !== undefined, ['dontEscape character', dontEscape, 'string', 'each']]
      ])) return false;
      var toEscape = ['-', '[', ']', '{', '}', '(', ')', '|', '+', '*', '?', '.', '/', '\\', '^', '$'];
      dale.do (dontEscape, function (v) {
         toEscape.splice (toEscape.indexOf (v), 1);
      });
      return string.replace (new RegExp ('[' + toEscape.join ('\\') + ']', 'g'), '\\$&');
   }

   cicek.etag = function (stringOrBuffer, weak) {
      var hash = crypto.createHash ('sha1');
      hash.update (stringOrBuffer);
      return (weak ? 'W/' : '') + '"' + hash.digest ('base64') + '"';
   }

   // *** COOKIE ***

   cicek.cookie = {
      nameValidator:  new RegExp ('^[' + cicek.escapeString ("!#$%&'*+-.^_`|~")             + '0-9a-zA-Z]+$'),
      valueValidator: new RegExp ('^[' + cicek.escapeString ("!#$%&'*+-.^_`|~/=?@<>()[]{}") + '0-9a-zA-Z]+$')
   }

   cicek.cookie.read = function (cookieString) {

      if (stop ('cicek.cookie.read', ['cookie string', cookieString, 'string'])) return false;

      var output = {};

      dale.do (cookieString.split (/;\s+/), function (v) {
         v = v.split ('=');
         var name = v [0];
         var value = v.slice (1).join ('=').slice (1, -1);
         if (cicek.options.cookieSecret) {
            var signature = value.split ('.').slice (-1) [0];
            value         = value.split ('.').slice (0, -1).join ('.');
            var hmac = crypto.createHmac ('sha256', cicek.options.cookieSecret);
            hmac.update (value);
            var digest = hmac.digest ('base64').replace (/=/g, '');
            if (signature !== digest) return cicek.out ({error: ['Invalid signature in cookie', {value: value, digest: digest, signature: signature}]});
         }
         output [name] = value;
      });
      return output;
   }

   cicek.cookie.write = function (name, value, options) {

      options = options || {};

      if (stop ('cicek.cookie.write', [
         ['name', name, 'string'],
         [value !== false, ['value', value, 'string', 'oneOf']],
         ['name', name,   cicek.cookie.nameValidator, teishi.test.match],
         [value !== false, ['value', value, cicek.cookie.valueValidator, teishi.test.match]],
         ['options', options, 'object'],
         [function () {return [
            ['options keys', dale.keys (options),  ['domain', 'path', 'expires', 'maxage', 'secure', 'httponly'], 'eachOf', teishi.test.equal],
            ['options.domain',   options.domain,   ['undefined', 'string'],         'oneOf'],
            ['options.path',     options.path,     ['undefined', 'string'],         'oneOf'],
            ['options.expires',  options.expires,  ['undefined', 'string', 'date'], 'oneOf'],
            ['options.maxage',   options.maxage,   ['undefined', 'integer'],        'oneOf'],
            ['options.secure',   options.secure,   ['undefined', 'boolean'],        'oneOf'],
            ['options.httponly', options.httponly, ['undefined', 'boolean'],        'oneOf'],
         ]}]
      ])) return false;

      if (options && type (options.expires) === 'date') options.expires = options.expires.toUTCString ();
      if (value === false)                              options.maxage  = 0;

      if (cicek.options.cookieSecret && value) {
         var hmac = crypto.createHmac ('sha256', cicek.options.cookieSecret);
         hmac.update (value);
         var signature = '.' + hmac.digest ('base64').replace (/=/g, '');
      }

      var cookie = name + '="' + value + (signature || '') + '"; ';

      dale.do (options, function (v, k) {
         if (k === 'maxage') k = 'max-age';
         if (v !== undefined) cookie += k + (v === true ? '' : '=' + v) + '; ';
      });
      return cookie;
   }

   // *** INITIALIZATION ***

   cicek.parser = function (Routes) {
      var routes = [];

      var validate = function (route) {
         return teishi.v ([
            ['çiçek route', route, 'array'],
            function () {return [
               [dale.stopNot (route [0], true, function (v) {
                  return type (v) === 'string';
               }) || false, [
                  ['çiçek route length', route.length, {min: 3}, teishi.test.range],
                  ['çiçek route method', route [0], ['string', 'array'], 'oneOf'],
                  [type (route [0]) === 'string', [
                     ['çiçek route method', route [0], cicek.http.methods.concat (['all']), 'oneOf', teishi.test.equal],
                  ]],
                  [type (route [0]) === 'array', [
                     ['çiçek route method', route [0], cicek.http.methods, 'eachOf', teishi.test.equal],
                  ]],
                  ['çiçek route path', route [1], ['regex', 'string'], 'eachOf'],
                  ['çiçek route function', route [2], 'function']
               ]]
            ]}
         ]);
      }

      var flatten = function (route) {

         if (validate (route) === false) return false;

         if (dale.stopNot (route [0], true, function (v) {
            return type (v) === 'string';
         })) {
            return dale.do (route [1], function (v2) {
               routes.push ([route [0]].concat ([v2]).concat (route.slice (2)));
            });
         }
         if (dale.stop (route, false, function (v) {
            return flatten (v);
         }) === false) return false;
      }

      if (flatten (Routes) === false) return false;

      // a char that's not a backslash, a backslash plus an opening parenthesis, 0-n chars that aren't a closing parenthesis, a backslash plus a closing parenthesis
      var matchParenthesis = /[^\\]\([^)]*\)/g;
      // slash, colon, 1 or more chars that aren't parenthesis nor slash
      var matchParameter   = /\/:[^()/]+/g;

      var invalidRoute = dale.stopNot (routes, undefined, function (route, index) {
         var path = route [1];
         if (type (path) === 'regex') return;
         var regex;
         if (path [0] !== '/') path = '/' + path;
         if (path.length > 1 && path [path.length - 1] === '/' && path [path.length - 2] !== '\\') path = path.slice (0, -1);

         var captures = [];
         dale.do (path.match (matchParenthesis), function (v, k) {
            if (v === null) return;
            captures.push ([path.indexOf (v.slice (1, v.length)), k]);
         });

         dale.do (path.match (matchParameter), function (v) {
            if (v === null) return;
            captures.push ([path.indexOf (v.slice (1, v.length)), v.slice (2, v.length)]);
         });

         captures.sort (function (a, b) {return a [0] > b [0]});
         path = cicek.escapeString (path, ['(', ')', '?', '*', '+', '/']);
         regex = '^' + path.replace (matchParameter, '\/([^()\/]+)') + '$';
         regex = regex.replace (/\*/g, '.*');
         try {
            regex = new RegExp (regex);
         }
         catch (error) {return path}
         captures = dale.do (captures, function (v) {return v [1]});
         routes [index] [1] = captures ? [regex, captures] : regex;
      });
      if (invalidRoute) return cicek.out ({error: ['Invalid route path', invalidRoute]});
      return routes;
   }

   cicek.listen = function () {
      var arg = 0;
      var port = arguments [arg++];
      var options = type (arguments [arg]) === 'object' ? arguments [arg++] : {};
      var routes = arguments [arg];

      if (stop ('çiçek listen', [
         ['port', port, 'integer'],
         ['port', port, {min: 1, max: 65535}, teishi.test.range],
         ['options keys', dale.keys (options), ['cookieSecret', 'fileCallback', 'https', 'beforeStart', 'afterStart', 'console', 'log', 'bodyLogLimit', 'cluster'], 'eachOf', teishi.test.equal],
         ['options.cookieSecret', options.cookieSecret, ['string',   'undefined'], 'oneOf'],
         ['options.fileCallback', options.fileCallback, ['function', 'undefined'], 'oneOf'],
         ['options.https',        options.https,        ['object',   'undefined'], 'oneOf'],
         ['options.beforeStart',  options.beforeStart,  ['function', 'undefined'], 'oneOf'],
         ['options.afterStart',   options.afterStart,   ['function', 'undefined'], 'oneOf'],
         ['options.console',      options.console,      ['function', 'boolean', 'undefined'], 'oneOf'],
         ['options.log',          options.log,          ['string', 'function', 'undefined'],  'oneOf'],
         ['options.bodyLogLimit', options.bodyLogLimit, ['integer',  'undefined'], 'oneOf'],
         ['options.cluster',      options.cluster,      ['integer',  'undefined'], 'oneOf'],
         [options.cluster !== undefined, ['options.cluster', options.cluster, {min: 1, max: os.cpus ().length}, teishi.test.range]],
         [options.https !== undefined, [function () {return [
            ['options.https.key',  options.https.key,  'string'],
            ['options.https.cert', options.https.cert, 'string'],
            ['options.https.only', options.https.only, ['boolean', 'undefined'], 'oneOf'],
            [! options.https.only, [
               ['options.https.port', options.https.port, {min: 1, max: 65535}, teishi.test.range],
               ['options.https.port', options.https.port, port, teishi.test.notEqual]
            ]]
         ]}]]
      ])) return false;

      if (options.fileCallback) cicek.options.fileCallback = options.fileCallback;

      if (options.cookieSecret) cicek.options.cookieSecret = options.cookieSecret;

      if (options.bodyLogLimit) cicek.options.bodyLogLimit = options.bodyLogLimit;

      cicek.options.console = options.console;
      cicek.options.log     = options.log;

      if (options.cluster === undefined) options.cluster = os.cpus ().length;

      routes = cicek.parser (routes);

      if (routes === false) return false;
      options.beforeStart = options.beforeStart || function (callback) {return callback ()};
      options.afterStart  = options.afterStart  || function () {
         if (! options.https || ! options.https.only) cicek.out (['Çiçek', 'listening in port', port, 'on ' + options.cluster + ' core' + (options.cluster > 1 ? 's' : '')]);
         if (options.https) cicek.out (['Çiçek', 'listening in port', options.https.only ? port : options.https.port, 'on ' + options.cluster + ' core' + (options.cluster > 1 ? 's' : '')]);
      }

      if (cluster.isMaster) {
         options.beforeStart (function () {
            var toStart = options.cluster;
            toStart2 = toStart;
            while (toStart-- > 0) {
               var worker = cluster.fork ();
               worker.on ('message', function (message) {
                  if (--toStart2 === 0) options.afterStart ();
               });
            }

            cluster.on ('exit', function (worker, code, signal) {
               cicek.out ({error: ['Worker died', {worker: worker, code: code, signal: signal}]});
            });
         });
      }
      else {
         var httpServer, httpsServer;

         if (options.https === undefined || ! options.https.only) {
            httpServer = http.createServer (function (request, response) {
               cicek.avant (request, response, routes);
            }).listen (port, function () {
               process.send ({ok: true});
            });
         }

         if (options.https) {
            httpsServer = https.createServer ({key: fs.readFileSync (options.https.key, 'utf8'), cert: fs.readFileSync (options.https.cert, 'utf8')}, function (request, response) {
               cicek.avant (request, response, routes);
            }).listen (options.https.only ? port : options.https.port, function () {
               process.send ({ok: true});
            });
         }
      }
   }

   // *** THE OUTER LOOP ***

   var requestNumber = 0;

   cicek.avant = function (request, response, routes) {
      response.request = request;

      request.data = {};

      response.log = {
         number: ++requestNumber,
         start: teishi.time ()
      }

      request.method = request.method.toLowerCase ();

      request.origin = request.headers ['x-forwarded-for'] || request.connection.remoteAddress || request.socket.remoteAddress || request.connection.socket.remoteAddress;

      var url = request.url;

      request.data.query = request.url.split ('?') [1];
      if (request.data.query) request.url = request.url.replace ('?' + request.data.query, '');

      try {
         request.url = decodeURIComponent (request.url);
         if (request.data.query) request.data.query = query.parse (decodeURIComponent (request.data.query));
      }
      catch (error) {
         return cicek.reply (response, 400, 'Invalid URL: ' + url);
      }
      if (request.data.query === undefined) delete request.data.query;

      cicek.out ({request: {number: response.log.number, origin: request.origin, method: request.method, url: request.url, headers: request.headers}});

      cicek.router (request, response, routes);
   }

   cicek.router = function (request, response, routes) {

      if (teishi.stop (['HTTP request headers', dale.keys (request.headers), cicek.http.requestHeaders, 'eachOf', teishi.test.match], function (error) {
         cicek.reply (response, 400, error);
      })) return false;

      var allowedMethods = [];
      if (dale.stopNot (routes, undefined, function (v, k) {
         if (response.offset !== undefined && k <= response.offset) return;
         var captures = type (v [1]) === 'regex' ? undefined : v [1] [1];
         var regex    = captures ? v [1] [0] : v [1];
         var match = request.url.match (regex);
         if (match === null) return;

         if (v [0] === 'all' || dale.stop (v [0], true, function (v2) {
            return v2 === request.method;
         })) {
            if (captures) {
               dale.do (captures, function (v2, k2) {
                  request.data.params = request.data.params || {};
                  request.data.params [v2] = match [k2 + 1];
               });
            }
            else {
               dale.do (match.slice (1), function (v, k) {
                  request.data.params = request.data.params || {};
                  request.data.params [k] = v;
               });
            }

            if (response.next === undefined) response.next = function () {
               cicek.router (request, response, routes);
            }

            if (response.offset === undefined) {
               response.offset = k;
               cicek.fork (request, response, v);
            }
            else {
               response.offset = k;
               v [2].apply (v [2], [request, response].concat (v.slice (3)));
            }
            return true;
         }

         dale.do (v [0], function (v2) {
            if (allowedMethods.indexOf (v2) === -1) allowedMethods.push (v2);
         });

      })) return;

      if (allowedMethods.length === 0) return cicek.reply (response, 404, 'Resource not found: ' + request.url);

      cicek.reply (response, 405, 'HTTP method ' + request.method + ' not supported for this route (' + request.url + '). Supported methods are: ' + allowedMethods.join (', '), {'allow': allowedMethods.join (', ')});

   }

   cicek.fork = function (request, response, route) {
      if (request.headers.cookie) {
         request.data.cookie = cicek.cookie.read (request.headers.cookie);
      }

      if (request.headers ['content-type'] && request.headers ['content-type'].match (/multipart\/form-data/i)) return cicek.receiveMulti (request, response, route);
      cicek.receive (request, response, route);
   }

   cicek.apres = function (response) {
      if (response.request.data.files) {
         dale.do (response.request.data.files, function (v) {
            fs.stat (v, function (error, stat) {
               if (error && error.code !== 'ENOENT') return cicek.out ({error: 'There was an error when trying to delete the file at path ' + v});
               if (! error) fs.unlink (v, function (error) {
                  if (error) cicek.out ({error: 'There was an error when trying to delete the file at path ' + v});
               });
            });
         });
      }
      response.log.url            = response.request.url,
      response.log.method         = response.request.method
      response.log.requestHeaders = response.request.headers;
      response.log.origin         = response.request.origin;
      response.log.end            = teishi.time ();
      response.log.duration       = response.log.end - response.log.start;

      cicek.out ({response: response.log});
   }

   // *** INPUT FUNCTIONS ***

   cicek.receive = function (request, response, route) {

      request.body = '';

      request.on ('data', function (incoming) {
         request.body += incoming;
      });

      request.on ('end', function () {
         var parsed;
         if (request.headers ['content-type'] === 'application/json') {
            parsed = teishi.p (request.body);
            if (parsed === false) return cicek.reply (response, 400, 'Expecting JSON, but instead received ' + request.body);
            request.body = parsed;
         }
         if (request.headers ['content-type'] === 'application/x-www-form-urlencoded') {
            try {
               parsed = query.parse (decodeURIComponent (request.body));
               request.body = parsed;
            }
            catch (error) {
               return cicek.reply (response, 400, 'Invalid body: ' + request.body);
            }
         }

         route [2].apply (route [2], [request, response].concat (route.slice (3)));
      });

      request.on ('error', function (error) {
         cicek.reply (response, 400, 'There was an error while receiving data from the request: ' + error);
      });
   }

   cicek.receiveMulti = function (request, response, route) {

      try {
         var busboy = new Busboy ({headers: request.headers});
      }
      catch (error) {
         return cicek.reply (response, 400, 'Invalid headers sent.');
      }

      request.data.fields = {};
      request.data.files  = {};

      busboy.on ('error', function (error) {
         cicek.reply (response, 400, error);
      });

      busboy.on ('field', function (field, value, fieldTruncated, valTruncated) {
         request.data.fields [field] = value;
      });

      var fileCallback = function (field, file, value, encoding, mimetype) {

         var random = dale.do (crypto.randomBytes (24), function (v) {
            return ('0' + v.toString (16)).slice (-2);
         }).join ('');

         request.data.files [field] = path.join (os.tmpDir (), random + '_' + value);

         file.pipe (fs.createWriteStream (request.data.files [field]));

         file.on ('error', function (error) {
            cicek.reply (response, 400, error);
         });
      }

      busboy.on ('file', cicek.options.fileCallback || fileCallback);

      busboy.on ('finish', function () {
         route [2].apply (route [2], [request, response].concat (route.slice (3)));
      });

      request.pipe (busboy);
   }

   // *** OUTPUT FUNCTIONS ***

   cicek.reply = function () {
      var arg = 0;
      if (arguments [0].writable === undefined) arg++;
      var response    = arguments [arg++];
      var code        = type (arguments [arg]) === 'integer' ? arguments [arg++] : 200;
      var body        = arguments [arg++];
      var headers     = type (arguments [arg]) === 'object'  ? arguments [arg++] : {};
      var contentType = type (arguments [arg]) === 'string'  ? arguments [arg]   : undefined;

      if (stop ('cicek.reply', [
         ['response.connection', response.connection, undefined, teishi.test.notEqual],
         function () {return ['response.connection.writable', response.connection.writable, true, teishi.test.equal]},
         ['çiçek head HTTP status code', code, cicek.http.codes, 'oneOf', teishi.test.equal],
         ['çiçek head HTTP response header key', dale.keys (headers), cicek.http.responseHeaders, 'eachOf', teishi.test.match],
         ['çiçek head HTTP response header value', headers, ['string', 'integer'], 'eachOf'],
      ], function (error) {
         response.writeHead (500, {'content-type': 'text/plain; charset=utf-8'});
         response.end (error);
      })) return false;

      if (! body && body !== 0) body = '';
      var bodyType = type (body);

      if (bodyType === 'object' || bodyType === 'array') {
         var JSON = teishi.s (body);
         if (JSON === false) return cicek.reply (response, 500, 'Trying to serve invalid JSON: ' + body);
         body = JSON;
         if (headers ['content-type'] === undefined) headers ['content-type'] = 'application/json';
      }
      if (bodyType !== 'string') body += '';

      var callback = function (error, data) {
         if (error) {
            head = 500;
            body = 'Compression error.';
         }

         response.log.code = code;
         response.log.body = body;
         response.log.responseHeaders = headers;

         response.writeHead (code, headers);
         response.end (data);

         cicek.apres (response);
      }

      if (contentType) headers ['content-type'] = mime.lookup (contentType) + '; charset=utf-8';

      if (response.request.method === 'get' || response.request.method === 'post') {
         if (headers.etag === false)     headers.etag = undefined;
         if (headers.etag === undefined) headers.etag = cicek.etag (body, true);
         if (response.request.headers ['if-none-match'] && response.request.headers ['if-none-match'] === headers.etag && code === 200) {
            // http://stackoverflow.com/a/4393499 on no header override
            code = 304;
            return callback (null, '');
         }
      }

      // explain override encoding with 'no'
      var encoding = response.request.headers ['accept-encoding'] || '';

      if (encoding.match ('deflate')) {
         headers ['content-encoding'] = 'deflate';
         zlib.deflate (body, callback);
      }
      else if (encoding.match ('gzip')) {
         headers ['content-encoding'] = 'gzip';
         zlib.gzip    (body, callback);
      }
      else callback (null, body);
   }

   cicek.file = function () {

      var arg = 0;
      var request  = arguments [0].writable === undefined ? arguments [arg++] : undefined;
      var response = arguments [arg++];
      var file     = type (arguments [arg]) === 'string'  ? arguments [arg++] : undefined;
      var paths    = type (arguments [arg]) === 'array'   ? arguments [arg++] : [__dirname];
      var headers  = arguments [arg] === 'object'         ? arguments [arg++] : {};
      var dots     = arguments [arg] === true             ? true              : false;

      if (stop ('cicek.file', [
         ['response.connection', response.connection, undefined, teishi.test.notEqual],
         function () {return ['response.connection.writable', response.connection.writable, true, teishi.test.equal]},
         ['çiçek head HTTP response header', dale.keys (headers), cicek.http.responseHeaders, 'eachOf', teishi.test.match],
         [paths !== undefined, [
            ['paths', paths, 'string', 'each'],
            function () {return ['paths length', paths.length, {min: 1}, teishi.test.range]}]
         ],
         [request === undefined, ['file', file, 'string']]
      ], function (error) {
         cicek.reply (response, 500, error);
      }));

      if (! file && dots !== true && request.url.match (/\.\./) !== null) return cicek.reply (response, 400, 'No dots (..) allowed in çiçek path, but path is: ' + request.url);

      if (file === undefined) file = (request.data.params && request.data.params ['0']) || request.url;

      // explain override encoding with 'no'
      // y override etag con false
      var encoding = response.request.headers ['accept-encoding'] || '';

      if (encoding.match ('deflate')) {
         encoding = zlib.createDeflate ();
         headers ['content-encoding'] = 'deflate';
      }
      else if (encoding.match ('gzip')) {
         headers ['content-encoding'] = 'gzip';
         encoding = zlib.createGzip ();
      }
      else encoding = false;

      var counter = 0;

      var callback = function (code, Path) {
         response.log.code = code;
         response.log.responseHeaders = headers;
         response.log.body = '[FILE OMITTED]';
         if (Path) response.log.path = Path;
         cicek.apres (response)
      }

      var find = function () {
         var Path = path.join (paths [counter], file);
         fs.stat (Path, function (error, stats) {
            counter++;
            if (error || stats.isFile () !== true) {
               if (error && error.code !== 'ENOENT')  return cicek.reply (response, 500, error);
               if (counter === paths.length)          return cicek.reply (response, 404, 'File ' + file + ' not found.');
               return find ();
            }

            if (headers.etag === false)     headers.etag = undefined;
            if (headers.etag === undefined) headers.etag = cicek.etag (teishi.s ([stats.mtime, stats.size]));

            if (headers ['content-type'] === undefined) headers ['content-type'] = mime.lookup (Path) + '; charset=utf-8';

            if (response.request.headers ['if-none-match'] === headers.etag) {
               response.writeHead (304, headers);
               response.end ();
               return callback (304);
            }

            response.writeHead (200, headers);
            var stream = fs.createReadStream (Path);
            if (encoding) stream.pipe (encoding).pipe (response);
            else          stream.pipe (response);

            stream.on ('end', function () {
               callback (200, Path);
            });
         });
      }
      find ();
   }

}) ();
