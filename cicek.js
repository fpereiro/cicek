/*
çiçek - v3.2.2

Written by Federico Pereiro (fpereiro@gmail.com) and released into the public domain.

Please refer to readme.md to read the annotated source (but not yet!).
*/

(function () {

   // *** SETUP ***

   var cluster = require ('cluster');
   var crypto  = require ('crypto');
   var fs      = require ('fs');
   var http    = require ('http');
   var https   = require ('https');
   var os      = require ('os');
   var path    = require ('path');
   var query   = require ('querystring');
   var stream  = require ('stream');
   var zlib    = require ('zlib');

   var Busboy  = require ('busboy');
   var mime    = require ('mime');
   var dale    = require ('dale');
   var teishi  = require ('teishi');

   var type    = teishi.t;
   var log     = teishi.l;

   var cicek   = exports;

   // *** HTTP CONSTANTS ***

   cicek.http = {
      methods: ['get', 'head', 'post', 'put', 'delete', 'trace', 'connect', 'patch', 'options'],
      codes:  dale.do (dale.keys (http.STATUS_CODES), function (v) {return parseInt (v)})
   }

   // *** OPTIONS ***

   cicek.options = {
      headers: {},
      cookieSecret: null,
      log: {
         body: false,
         console: true,
         file: {
            path: null,
            stream: null,
            streamIn: null,
            rotationSize: 10,
            rotationFreq: 10
         }
      }
   }

   // *** HELPER FUNCTIONS ***

   cicek.pseudorandom = function (length) {
      return dale.do (crypto.pseudoRandomBytes (24), function (v) {
         return ('0' + v.toString (16)).slice (-2);
      }).join ('').slice (0, length || 12);
   }

   cicek.stop = function (fun, rules) {
      return teishi.stop (fun, rules, function (error) {
         cicek.log (['error', 'server error', error]);
      });
   }

   cicek.escape = function (string, dontEscape) {
      if (cicek.stop ('çiçek.escape', [
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

   // *** CLUSTER ***

   cicek.isMaster = cluster.isMaster;

   cicek.cluster = function (cpus, onerror) {

      if (! cicek.isMaster) return process.on ('uncaughtException', function (error) {
         cicek.log (['error', 'worker error', {error: error.toString (), stack: error.stack}]);
         process.exit (1);
      });

      cicek.options.cluster = true;

      if (cpus === undefined) cpus = os.cpus ().length;
      if (cicek.stop ('cicek.cluster', [
         ['cpus', cpus, ['integer', 'undefined'], 'oneOf'],
         ['cpus', cpus, {min: 1, max: os.cpus ().length}, teishi.test.range],
         ['onerror', onerror, ['function', 'undefined'], 'oneOf']
      ])) return false;

      if (cicek.options.log.file.path) cicek.logfile ()

      var spawn = function () {
         var worker = cluster.fork ();
         worker.on ('message', function (message) {
            cicek.log (JSON.parse (message), true);
         });
      }

      dale.do (dale.times (cpus), spawn);

      cluster.on ('exit', function (worker, code, signal) {
         cicek.log (['error', 'worker died', {workerId: worker.id, code: code, signal: signal}]);
         onerror ? onerror (worker, code, signal) : spawn ()
      });

   }

   // *** LOGGING ***

   // message is always assumed to be an array or converted.
   cicek.log = function (message, fromWorker) {
      if (type (message) !== 'array') message = [message];

      if (! fromWorker) {
         message.unshift (new Date ().toISOString ());
         message.unshift (cluster.isMaster ? 'master' : 'worker' + cluster.worker.id);
      }

      if (cicek.options.log.console) cicek.logconsole (message);
      if (cicek.options.log.file) cicek.logfile (message);
   }

   cicek.logconsole = function (message) {

      if (! cicek.isMaster && message [2] !== 'requestContent') return;

      if (message [2] === 'request') message = [[' REQUEST ' + message [3].id, message [3].method.toUpperCase (), message [3].url].join (' ')].concat ([message [3].origin, 'REQ-HEADERS:', message [3].requestHeaders]).concat (dale.keys (message [3].data).length === 0 ? [] : ['REQ-DATA:', message [3].data]);

      else if (message [2] === 'requestContent') {
         var logBody = type (cicek.options.log.body) === 'function' ? cicek.options.log.body (message [3]) : cicek.options.log.body;
         if (! logBody) return;

         if (message [3].requestBody) message = [[' REQ-BODY ' + message [3].id, message [3].method.toUpperCase (), message [3].url].join (' ')].concat (['REQ-BODY', message [3].requestBody]);
         else if (message [3].data && (message [3].data.fields || message [3].data.files))
            message = [[' REQ-FORM ' + message [3].id, message [3].method.toUpperCase (), message [3].url].join (' ')].concat (['REQ-FORM', {fields: message [3].data.fields, files: message [3].data.files}])
         else return;
      }

      else if (message [2] === 'response') message = [['RESPONSE ' + message [3].id, message [3].method.toUpperCase (), message [3].url].join (' ')].concat ([
         '\033[37m\033[4' + {1: 6, 2: 2, 3: 4, 4: 3, 5: 1} [(message [3].code + '') [0]] + 'm' + message [3].code + '\033[0m\033[1m',
         '(' + message [3].duration + 'ms)',
         'RES-HEADERS:', message [3].responseHeaders,
         message [3].responseBody ? 'RES-BODY:' : '',
         message [3].responseBody ? message [3].responseBody : '',
         message [3].path ? 'RES-PATH: ' + message [3].path : ''
      ]);

      console.log ('-----------');
      log.apply (null, message);
   }

   cicek.logfile = function (message) {

      if (! cicek.isMaster) {
         if (message [2] === 'requestContent') return;
         if (message [2] === 'response') {
            var logBody = type (cicek.options.log.body) === 'function' ? cicek.options.log.body (message [3]) : cicek.options.log.body;
            if (! logBody && message [3].data) {
               delete message [3].data.fields;
               delete message [3].data.files;
               delete message [3].requestBody;
               delete message [3].responseBody;
            }
         }
         return process.send (JSON.stringify (message));
      }

      var options = cicek.options.log.file;

      if (! options.stream && type (options.path) === 'string') {

         options.streamIn = new stream.PassThrough ();
         options.stream   = fs.createWriteStream (options.path, {flags: 'a'});
         options.stream.on ('error', function (error) {
            if (error) return cicek.log (['error', 'cicek.logfile init error', error.toString (), error.stack]);
         });

         options.streamIn.pipe (options.stream);

         setInterval (function () {
            fs.stat (options.path, function (error, stat) {
               if (error) return cicek.log (['error', 'logrotate stat error', error.toString (), error.stack]);
               if (stat.size <= options.rotationSize * 1024 * 1024) return;
               options.streamIn.unpipe (options.stream);

               var name = path.join (path.dirname (options.path), new Date ().toISOString () + '__' + path.basename (options.path) + '.gz');

               options.stream.on ('end', function () {
                  var write = fs.createWriteStream (name);
                  fs.createReadStream (options.path).pipe (zlib.createGzip ()).pipe (write);
                  write.on ('error', function (error) {
                     if (error) return cicek.log (['error', 'logrotate rename error', error.toString (), error.stack]);
                  });
                  write.on ('finish', function () {
                     fs.unlink (options.path, function (error) {
                        if (error) return cicek.log (['error', 'logrotate delete error', error.toString (), error.stack]);
                        options.stream = fs.createWriteStream (options.path, {flags: 'a'});
                        options.streamIn.pipe (options.stream);
                     });
                  });
               });

               options.stream.emit ('end');
            });
         }, options.rotationFreq * 60 * 1000)

         if (! message) return;
      }

      if (options.streamIn) options.streamIn.write (teishi.s (message) + '\n');
   }

   // *** COOKIE ***

   cicek.cookie = {
      nameValidator:  new RegExp ('^[' + cicek.escape ("!#$%&'*+-.^_`|~")             + '0-9a-zA-Z]+$'),
      valueValidator: new RegExp ('^[' + cicek.escape ("!#$%&'*+-.^_`|~/=?@<>()[]{}") + '0-9a-zA-Z]+$')
   }

   cicek.cookie.read = function (cookieString) {

      if (cicek.stop ('cicek.cookie.read', ['cookie string', cookieString, 'string'])) return false;

      var output = {};

      dale.do (cookieString.split (/;\s+/), function (v) {
         if (! v) return;
         v = v.split ('=');
         var name = v [0];
         var value = v.slice (1).join ('=').slice (1, -1);
         if (cicek.options.cookieSecret) {
            var signature = value.split ('.').slice (-1) [0];
            value         = value.split ('.').slice (0, -1).join ('.');
            var hmac = crypto.createHmac ('sha256', cicek.options.cookieSecret);
            hmac.update (value);
            var digest = hmac.digest ('base64').replace (/=/g, '');
            if (signature !== digest) return cicek.log (['error', 'Invalid signature in cookie', {value: value, digest: digest, signature: signature}]);
         }
         output [name] = value;
      });
      return output;
   }

   cicek.cookie.write = function (name, value, options) {

      options = options || {};

      if (cicek.stop ('cicek.cookie.write', [
         ['name', name, 'string'],
         ['name', name,   cicek.cookie.nameValidator, teishi.test.match],
         [value !== false, [
            ['value', value, 'string'],
            ['value', value, cicek.cookie.valueValidator, teishi.test.match]
         ]],
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
      if (value === false) options.maxage = 0;

      if (cicek.options.cookieSecret && value) {
         var hmac = crypto.createHmac ('sha256', cicek.options.cookieSecret);
         hmac.update (value);
         var signature = '.' + hmac.digest ('base64').replace (/=/g, '');
      }

      var cookie = name + '="' + value + (signature || '') + '"; ';

      dale.do (options, function (v, k) {
         k = {
            expires:  'Expires',
            maxage:   'Max-Age',
            domain:   'Domain',
            path:     'Path',
            secure:   'Secure',
            httponly: 'HttpOnly'
         } [k];
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
         path = cicek.escape (path, '*?+()|'.split (''));
         regex = '^' + path.replace (matchParameter, '\/([^()\/]+)') + '$';
         regex = regex.replace (/\*/g, '.*');
         try {
            regex = new RegExp (regex);
         }
         catch (error) {return path}
         captures = dale.do (captures, function (v) {return v [1]});
         routes [index] [1] = captures ? [regex, captures] : regex;
      });
      if (invalidRoute) return cicek.log (['error', 'invalid route', invalidRoute]);
      return routes;
   }

   cicek.listen = function (options, routes, cb) {

      if (cicek.options.cluster && cicek.isMaster) return;

      if (cicek.stop ('çiçek listen', [
         ['options', options, 'object'],
         function () {return [
            ['options keys', dale.keys (options), ['port', 'https'], 'eachOf', teishi.test.equal],
            ['options.port', options.port, 'integer'],
            ['options.port', options.port, {min: 1, max: 65535}, teishi.test.range],
            ['options.https', options.https, ['object',   'undefined'], 'oneOf'],
            [options.https !== undefined, [function () {return [
               ['options.https.key',  options.https.key,  'string'],
               ['options.https.cert', options.https.cert, 'string'],
            ]}]],
            ['cb', cb, ['function', 'undefined'], 'oneOf']
         ]}
      ])) return false;

      routes = cicek.parser (routes);

      if (routes === false) return false;

      var server, requestListener = function (request, response) {
         cicek.avant (request, response, routes);
      }

      if (options.https) server = https.createServer ({
         key:  options.https ? fs.readFileSync (options.https.key, 'utf8')  : null,
         cert: options.https ? fs.readFileSync (options.https.cert, 'utf8') : null
      }, requestListener);
      else               server = http.createServer (requestListener);

      server.listen (options.port, function () {
         cicek.log (['start', 'cicek', 'listening in port', options.port]);
         if (cb) cb (server);
      });

      server.on ('clientError', function (error) {
         cicek.log (['error', 'client error', error.toString (), error.code, error.stack]);
      });

      return server;
   }

   // *** THE OUTER LOOP ***

   cicek.Avant = function (request, response, routes) {

      response.request = request;

      request.data     = {};
      request.method   = request.method.toLowerCase ();
      request.origin   = request.headers ['x-forwarded-for'] || request.connection.remoteAddress;

      response.log = {
         startTime:      teishi.time (),
         id:             cicek.pseudorandom (),
         origin:         request.origin,
         method:         request.method,
         url:            request.url,
         requestHeaders: request.headers,
         data:           request.data
      }

      try {
         response.log.url = request.url = decodeURIComponent (request.url);
      }
      catch (error) {
         return cicek.reply (response, 400, 'Invalid URL: ' + request.url);
      }

      // http://stackoverflow.com/a/2924187
      if (request.url.match (/\?/)) {
         try {
            request.data.query = query.parse (request.url.match (/\?[^#]+/g) [0].slice (1));
            response.log.rawurl = request.rawurl = request.url;
            response.log.url    = request.url    = request.url.replace (/\?[^#]+/g, '');
         }
         catch (error) {
            return cicek.reply (response, 400, 'Invalid query string: ' + request.data.query);
         }
      }

      if (request.headers.cookie) request.data.cookie = cicek.cookie.read (request.headers.cookie);

      cicek.log (['request', response.log]);

      cicek.router (request, response, routes);
   }

   cicek.avant = cicek.Avant;

   cicek.router = function (request, response, routes, offset) {

      var allowedMethods = [];
      if (dale.stopNot (routes, undefined, function (v, k) {
         if (offset !== undefined && k <= offset) return;
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

            response.next = function () {
               cicek.router (request, response, routes, k);
            }

            if (offset === undefined) cicek.fork (request, response, v);
            else                      v [2].apply (v [2], [request, response].concat (v.slice (3)));

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
      var next = (request.headers ['content-type'] && request.headers ['content-type'].match (/^multipart\/form-data/i)) ? cicek.receiveMulti : cicek.receive;
      next (request, response, route);
   }

   cicek.Apres = function (response) {
      dale.do (response.request.data.files, function (v) {
         dale.do (v, function (v2) {
            fs.stat (v2, function (error, stat) {
               if (error && error.code !== 'ENOENT') return cicek.log (['error', 'temp file deletion error 1', v2]);
               if (! error) fs.unlink (v2, function (error) {
                  if (error) cicek.log (['error', 'temp file deletion error 2', v2]);
               });
            });
         });
      });
      response.log.endTime  = teishi.time ();
      response.log.duration = response.log.endTime - response.log.startTime;

      cicek.log (['response', response.log]);
   }

   cicek.apres = cicek.Apres;

   // *** INPUT FUNCTIONS ***

   cicek.json = function (fun) {
      return function (request, response) {
         var bodyType = type (request.body);
         if (bodyType !== 'array' && bodyType !== 'object') return cicek.reply (response, 400, {error: 'Must submit a JSON body.'});
         else fun.apply (null, arguments);
      }
   }

   cicek.receive = function (request, response, route) {

      if (request.method === 'post' && (! request.headers ['content-type'] || ! request.headers ['content-type'].match (/^application\/json/i))) return cicek.reply (response, 400, 'All post requests must be either multipart/form-data or application/json!');

      // https://nodejs.org/api/stream.html#stream_readable_setencoding_encoding
      // "If you want to read the data as strings, always use this method."
      request.setEncoding ('utf8');

      request.body = '';

      request.on ('data', function (buffer) {
         request.body += buffer.toString ();
      });

      request.on ('end', function () {

         var parsed;
         if (request.headers ['content-type'] === 'application/json') {
            parsed = teishi.p (request.body);
            if (parsed === false) return cicek.reply (response, 400, 'Invalid JSON string: ' + request.body);
         }
         if (request.headers ['content-type'] === 'application/x-www-form-urlencoded') {
            try {
               parsed = query.parse (decodeURIComponent (request.body));
            }
            catch (error) {
               return cicek.reply (response, 400, 'Invalid urlencoded string: ' + request.body);
            }
         }
         if (parsed) request.body = parsed;

         response.log.requestBody = request.body;
         cicek.log (['requestContent', response.log]);
         route [2].apply (route [2], [request, response].concat (route.slice (3)));
      });

      request.on ('error', function (error) {
         cicek.reply (response, 400, 'There was an error while receiving data from the request: ' + error);
      });
   }

   cicek.receiveMulti = function (request, response, route) {

      var Error, Finish;
      var files = 0;

      var errorCb = function (errorType, errorCode) {
         return function (error) {
            cicek.log (['error', 'multipart error'].concat ([errorType + ':', request.headers, error.toString (), error.stack]));
            if (! Error) cicek.reply (response, errorCode || 400, error);
            Error = true;
         }
      }

      try {
         var busboy = new Busboy ({headers: request.headers});
      }
      catch (error) {
         return errorCb ('Invalid headers sent') (error);
      }

      request.data.fields = {};
      request.data.files  = {};

      busboy.on ('error', errorCb ('Busboy error'));

      busboy.on ('field', function (field, value, fieldTruncated, valTruncated) {
         request.data.fields [field] = value;
      });

      busboy.on ('file', function (field, file, value, encoding, mimetype) {

         files++;
         var filename = path.join ((os.tmpdir || os.tmpDir) (), cicek.pseudorandom (24) + '_' + value);
         if (request.data.files [field]) {
            if (type (request.data.files [field]) === 'string') request.data.files [field] = [request.data.files [field], filename];
            else                                                request.data.files [field].push (filename);
         }
         else request.data.files [field] = filename;

         var save = fs.createWriteStream (filename);

         save.on ('finish', function () {
            if (--files === 0 && ! Error && Finish) {
               cicek.log (['requestContent', response.log]);
               route [2].apply (route [2], [request, response].concat (route.slice (3)));
            }
         });

         save.on ('error', errorCb ('çiçek FS error', 500));
         file.on ('error', errorCb ('Busboy file error'));

         file.pipe (save);
      });

      busboy.on ('finish', function () {
         if (files === 0 && ! Error && ! Finish) {
            cicek.log (['requestContent', response.log]);
            route [2].apply (route [2], [request, response].concat (route.slice (3)));
         }
         Finish = true;
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
      var headers     = type (arguments [arg]) === 'object' ? arguments [arg++] : {};
          headers     = dale.obj (headers, teishi.c (cicek.options.headers), function (v, k) {if (v !== undefined) return [k, v]});
      var contentType = type (arguments [arg]) === 'string'  ? arguments [arg]   : undefined;
      var apres;

      if (teishi.stop ('cicek.reply', [
         ['response.connection', response.connection, [undefined, null], 'oneOf', teishi.test.notEqual],
         function () {return ['response.connection.writable', response.connection.writable, true, teishi.test.equal]},
         ['HTTP status code', code, cicek.http.codes, 'oneOf', teishi.test.equal],
         ['HTTP response header value', headers, ['string', 'integer', 'boolean'], 'eachOf'],
         // http://stackoverflow.com/questions/5251824/sending-non-ascii-text-in-http-post-header
         // http://stackoverflow.com/questions/3203190/regex-any-ascii-character
         dale.do (headers, function (v) {
            if (! v.match) return [];
            return ['HTTP response header string value', v, /^[\x00-\x7F]+/, teishi.test.match];
         }),
      ], function (error) {
         cicek.log (['error', 'cicek.reply validation error', error]);
         if (response && response.connection) cicek.reply (response, 500, {error: error}, {'content-type': 'text/plain; charset=utf-8'});
      })) return false;

      if (! body && body !== 0) body = '';
      var bodyType = type (body);

      if (bodyType === 'object' || bodyType === 'array') {
         var JSON = teishi.s (body);
         if (JSON === false) return cicek.reply (response, 500, {error: 'Server attempted to serve invalid JSON: ' + body});
         body = JSON;
         if (headers ['content-type'] === undefined) headers ['content-type'] = 'application/json';
      }
      if (bodyType !== 'string') body += '';

      if (contentType) headers ['content-type'] = mime.lookup (contentType) + '; charset=utf-8';

      var outro = function (cached, compressed, uncompressed) {
         if (cached) code = 304;
         body = cached ? '' : compressed;
         response.log.code            = code;
         response.log.responseHeaders = headers;
         response.log.responseBody    = uncompressed;

         response.writeHead (code, headers);
         response.end (body);
         cicek.apres (response);
      }

      if (cicek.cache (response.request.method, body, response.request.headers, headers, code)) return outro (true);
      cicek.compress (response.request.headers, headers, body, outro, response);
   }

   cicek.etag = function (stringOrBuffer, weak) {
      var hash = crypto.createHash ('sha1');
      hash.update (stringOrBuffer);
      return (weak ? 'W/' : '') + '"' + hash.digest ('base64') + '"';
   }

   cicek.cache = function (method, body, reqHeaders, resHeaders, code) {
      if (method !== 'get' && method === 'post') return;
      if (resHeaders.etag === false) delete resHeaders.etag;
      else if (resHeaders.etag === undefined) resHeaders.etag = cicek.etag (body, true);
      return reqHeaders ['if-none-match'] && reqHeaders ['if-none-match'] === resHeaders.etag && code === 200;
   }

   cicek.compress = function (reqHeaders, resHeaders, content, outro, response) {

      if (resHeaders ['content-encoding'] === false) {
         delete resHeaders ['content-encoding'];
         return outro (null, content, content);
      }

      var encoding = reqHeaders ['accept-encoding'];
      // https://zoompf.com/blog/2012/02/lose-the-wait-http-compression
      if (! encoding || ! encoding.match ('gzip')) return outro (null, content, content);

      resHeaders ['content-encoding'] = 'gzip';
      if (type (content) === 'string') {
         zlib.gzip (content, function (error, compressed) {
            if (error) return cicek.reply (response, 500, {error: 'Compression error'});
            return outro (null, compressed, content);
         });
      }
      else {
         var cstream = zlib.createGzip ();
         content.pipe (cstream);
         outro (null, cstream);
      }
   }

   cicek.file = function () {

      var arg = 0;
      var request  = arguments [0].writable === undefined ? arguments [arg++] : undefined;
      var response = arguments [arg++];
      var file     = type (arguments [arg]) === 'string'  ? arguments [arg++] : undefined;
      var paths    = type (arguments [arg]) === 'array'   ? arguments [arg++] : [path.dirname (process.argv [1])];
      var headers  = type (arguments [arg]) === 'object' ? arguments [arg++] : {};
      headers = dale.obj (headers, teishi.c (cicek.options.headers), function (v, k) {if (v !== undefined) return [k, v]});
      var dots     = arguments [arg] === true             ? true              : false;

      if (cicek.stop ('cicek.file', [
         ['response.connection', response.connection, undefined, teishi.test.notEqual],
         function () {return ['response.connection.writable', response.connection.writable, true, teishi.test.equal]},
         [paths !== undefined, [
            ['paths', paths, 'string', 'each'],
            function () {return ['paths length', paths.length, {min: 1}, teishi.test.range]}]
         ],
         [request === undefined, ['file', file, 'string']]
      ], function (error) {
         cicek.log (['error', 'cicek.file validation error', error]);
         if (response && response.connection) cicek.reply (response, 500, error, {'content-type': 'text/plain; charset=utf-8'});
      }));

      if (! file && dots !== true && request.url.match (/\.\./) !== null) return cicek.reply (response, 400, 'No dots (..) allowed in çiçek path, but path is: ' + request.url);

      if (file === undefined) file = (request.data.params && request.data.params ['0']) || request.url;

      var outro = function (cached, stream) {
         response.log.code            = cached ? 304 : 200;
         response.log.responseBody    = '[FILE OMITTED]';
         response.log.responseHeaders = headers;

         response.writeHead (response.log.code, headers);
         if (cached) response.end ();
         else stream.pipe (response);

         cicek.apres (response)
      }

      var counter = 0;

      var find = function () {
         var filepath = path.join (path.dirname (paths [counter] [0] === '/' ? '/' : process.argv [1]), paths [counter], file);
         fs.stat (filepath, function (error, stats) {
            counter++;
            if (error || stats.isFile () !== true) {
               if (error && error.code !== 'ENOENT')  return cicek.reply (response, 500, error);
               if (counter === paths.length)          return cicek.reply (response, 404, 'File ' + file + ' not found.');
               return find ();
            }
            response.log.path = filepath;

            if (headers ['content-type'] === undefined) headers ['content-type'] = mime.lookup (filepath) + '; charset=utf-8';

            var stream = fs.createReadStream (filepath);
            if (cicek.cache (response.request.method, JSON.stringify ([stats.mtime, stats.size]), response.request.headers, headers, 200)) return outro (true, stream);
            cicek.compress (response.request.headers, headers, stream, outro, response);
         });
      }
      find ();
   }

}) ();
