/*
çiçek - v3.4.2

Written by Federico Pereiro (fpereiro@gmail.com) and released into the public domain.

To run the test first run `node test` at the command prompt and then open the url `localhost:8000` with your browser.
*/

(function () {

   // *** SETUP ***

   var isNode = typeof exports === 'object';
   var dale   = isNode ? require ('dale')   : window.dale;
   var teishi = isNode ? require ('teishi') : window.teishi;
   var type   = teishi.type;

   if (isNode) {

      var cicek  = require ('./cicek.js');
      var reply  = cicek.reply;
      var fs     = require ('fs');

      var echo = function (request, response) {

         if (response.echo === undefined) {
            response.echo = true;
            cicek.log ('Passing through common route.');
            return response.next ();
         }

         request.data.body = request.body;

         if (dale.keys (request.data.files).length > 0) {
            var onefile = request.data.files [dale.keys (request.data.files) [0]];
            if (type (onefile) === 'array') onefile = onefile [0];
            fs.readFile (onefile, 'utf8', function (error, data) {
               if (error) return reply (response, 500, error);
               request.data.fileContent = data;
               reply (response, 200, JSON.stringify (request.data, null, '   '), {'content-encoding': request.data.query && request.data.query.compression ? false : undefined}, 'application/json');
            });
         }
         else reply (response, 200, JSON.stringify (request.data, null, '   '), {'content-encoding': request.data.query && request.data.query.compression ? false : undefined}, 'application/json');

      }

      var cookieSet = function (request, response) {
         reply (response, 200, '', {
            'set-cookie': cicek.cookie.write ('rat', 'salad', {expires: new Date (10000000000000)})
         });
      }

      var cookieDelete = function (request, response) {
         reply (response, 200, '', {
            'set-cookie': cicek.cookie.write ('rat', false)
         });
      }

      cicek.options.cookieSecret  = 'c0okies3cret';
      cicek.options.log.file.path = 'cicek.log';
      //cicek.options.log.file.rotationSize = 0.1,
      //cicek.options.log.file.rotationFreq = 0.1,
      cicek.options.log.body = function (log) {
         return log.url.match (/auth/) === null;
      }
      cicek.options.headers ['x-powered-by'] = 'cicek';

      cicek.cluster ();

      cicek.listen ({port: 8000}, [
         ['all', '*', echo],
         ['get', [], echo],
         ['get', '/', reply, dale.go (['https://code.jquery.com/jquery-2.1.4.js', 'files/dale/dale.js', 'files/teishi/teishi.js', 'files/test.js'], function (v) {return '<script src="' + v + '"></script>'}).join (''), 'html'],
         ['get', 'files/(*)', cicek.file, ['.', '..', 'node_modules']],
         ['get', ['therats/(*)', 'fileswithdots/(*)'], cicek.file, ['node_modules/dale', 'node_modules/teishi/'], true],
         ['get', [/regex\/capt(u+)re(s)?/i, 'string/capt(u+)re(s)?', '/:first/:second/:third'], echo],
         ['get', '(a|b)', echo],
         ['post', ['data', 'upload'], echo],
         ['get', 'upload', reply, '<html><form action="upload" method="post" enctype="multipart/form-data"><input name="field1" value="field1"><input name="field2" value="field2"><input type="file" name="file1"><input type="file" name="file2"><input type="submit" value="Upload file"></form></html>', 'html'],
         ['get', 'data', reply, '<html><form action="data" method="post"><input name="field1" value="field1"><input name="field2" value="field2"><input type="submit" value="Send data"></form></html>', 'html'],
         [
            ['get', 'cookieSet', cookieSet],
            ['get', 'cookieDelete', cookieDelete]
         ],
         ['get', 'error', function (request, response) {
            throw new Error ('ERROR!');
         }]
      ]);
   }

   else {
      $ (function () {

         $ ('body').css ({'background-color': 'black', color: 'white'}).append ('<pre id="test"></pre>');

         var clog = function () {
            var output = '\n';

            var inner = function (v) {
               if (teishi.simple (v)) return output += v + ' ';
               dale.go (v, function (v2) {
                  inner (v2);
               });
            }

            inner (arguments);

            $ ('#test').append (output);
         }

         var state = {};

         var formData = new FormData ();
         formData.append ('field', 'some data');
         var content = '["Apollo Creed", "Ivan Drago"]';
         var blob = new Blob ([content], {type: 'application/json'});

         formData.append ('file', blob);

         var formEmpty = new FormData ();

         var formHack = new FormData ();
         var blob2 = new Blob ([content], {type: 'application/json'});
         formHack.append ('file', blob2, '/..');

         var formMultiple = new FormData ();
         var blob3 = new Blob ([content], {type: 'application/json'});
         var blob4 = new Blob ([content], {type: 'application/json'});
         formMultiple.append ('file', blob3);
         formMultiple.append ('file', blob4);

         var tests = [
            ['Check no crash on error', 'get', 'error', 0],
            ['Get a file from another directory', 'get', 'files/dale/dale.js'],
            ['Check that dots are not enabled by default in file serving', 'get', encodeURIComponent ('files/../id_rsa'), 400],
            ['Get file with dots in path where possible', 'get', encodeURIComponent ('fileswithdots/../../cicek.js'), 200, function (data, response) {
               state.etag = response.getResponseHeader ('etag');
               return true;
            }],
            ['Check etags for files', 'get', function (state) {return {'if-none-match': state.etag}}, encodeURIComponent ('fileswithdots/../../cicek.js'), 304],
            ['No such path', 'get', 'anypath', 404],
            ['Try other method for that path', 'put', 'files/dale.js', 405],
            ['Invalid json', 'post', {'content-type': 'application/json'}, 'data', 400],
            ['Valid json', 'post', {'content-type': 'application/json'}, 'data', '{"much": "data"}', 200, function (data, response) {
               return data && data.body && data.body.much === 'data';
            }],
            ['Valid json without compression', 'post', {'content-type': 'application/json'}, 'data?compression=none', '{"much": "data"}', 200, function (data, response) {
               return data && data.body && data.body.much === 'data';
            }],
            ['Invalid url', 'post', 'data%', '---', 400],
            ['Check default headers', 'get', '/param1/param2/param3', function (data, response) {
               return response.getResponseHeader ('x-powered-by') === 'cicek';
            }],
            ['Check url parameters', 'get', '/param1/param2/param3', function (data, response) {
               state.etag = response.getResponseHeader ('etag');
               return data.params.first === 'param1' && data.params.second === 'param2' && data.params.third === 'param3';
            }],
            ['Check etags for data', 'get', function (state) {return {'if-none-match': state.etag}}, '/param1/param2/param3', 304],
            ['Check parameters', 'get', '/param1/param2/param3?test1=a&test2=b', function (data, response) {
               return data.query.test1 === 'a' && data.query.test2 === 'b';
            }],
            ['Check url string captures', 'get', 'string/captures', function (data) {
               return data.params ['0'] === 'u' && data.params ['1'] === 's';
            }],
            ['Check url string captures (2)', 'get', 'string/captuuure', function (data) {
               return data.params ['0'] === 'uuu' && data.params ['1'] === undefined;
            }],
            ['Check url regex captures', 'get', 'regex/captures', function (data) {
               return data.params ['0'] === 'u' && data.params ['1'] === 's';
            }],
            ['Check url regex captures (2)', 'get', 'regex/captuuure', function (data) {
               return data.params ['0'] === 'uuu' && data.params ['1'] === undefined;
            }],
            ['Check url alternation (1)', 'get', 'a', function (data) {
               return data.params ['0'] === 'a';
            }],
            ['Check url alternation (2)', 'get', 'b', function (data) {
               return data.params ['0'] === 'b';
            }],
            ['Cookie set', 'get', 'cookieSet'],
            ['Check cookie and tamper it', 'get', '/param1/param2/param3', function (data) {
               if (data.cookie.rat !== 'salad') return false;
               document.cookie = 'rat=somesalad';
               return true;
            }],
            ['Check tampered cookie is ignored', 'get', '/param1/param2/param3', function (data) {
               return data.cookie.rat === undefined;
            }],
            ['Cookie delete', 'get', 'cookieDelete'],
            ['Check that no cookie is present', 'get', '/param1/param2/param3', function (data) {
               return data.cookie === undefined || data.cookie.rat === undefined;
            }],
            ['Upload file', 'post', 'upload', formData, function (data) {
               return data.fields.field === 'some data' && data.files.file && data.fileContent === content;
            }],
            ['Upload empty form', 'post', 'upload', formEmpty, function (data) {
               return Object.keys (data.fields).length === 0;
            }],
            ['Upload file to root', 'post', 'upload', formHack, function (data) {
               return data.files.file && data.fileContent === content;
            }],
            ['Upload multiple files', 'post', 'upload', formMultiple, function (data) {
               if (data.fileContent !== content) return false;
               if (! data.files || type (data.files.file) !== 'array' || data.files.file.length !== 2) return false;
               return true;
            }],
         ]

         var doTest = function () {

            var next = tests.shift ();

            var arg = 0;
            var tag     = next [arg++];
            var method  = next [arg++];
            var headers = type (next [arg]) === 'object'   ? next [arg++] : (type (next [arg]) === 'function' ? next [arg++] (state) : {});
            var url     = next [arg++];
            var body    = (type (next [arg]) === 'string' || typeof next [arg] === 'object') ? next [arg++] : '';
            var code    = type (next [arg]) === 'integer'  ? next [arg++] : 200;
            var check   = type (next [arg]) === 'function' ? next [arg++] : undefined;

            clog ('Testing:', tag);

            $.ajax ({
               method: method,
               url: url,
               headers: headers,
               data: body,
               processData: false,
               contentType: false
            }).always (function (a, Status, c) {
               var response = (Status === 'success' || Status === 'notmodified') ? c : a;
               if ((response.getResponseHeader ('content-type') || '').match (/^application\/json/)) {
                  response.responseText = teishi.parse (response.responseText);
               }
               if (response.status !== code || (check && ! check (response.responseText, response))) {
                  if (response.status !== code) clog ('Expecting code', code, 'but received code', response.status);
                  else                          clog ('Check function not passed!');
                  return clog ('\n<b style="color: red">There was an error in test "' + tag + '". Aborting.</b>');
               }
               if (tests.length > 0) {
                  // If we triggered an error, the browser will keep on asking a few times and it might bring down all the workers.
                  // https://www.w3.org/Protocols/rfc2616/rfc2616-sec8.html#sec8.2.4
                  if (code === 0) return setTimeout (doTest, 500);
                  return doTest ();
               }
               clog ('\n<b style="color: green">All tests were successful!</b>');
            });
         }

         doTest ();

      });
   }

}) ();
