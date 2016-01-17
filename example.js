/*
çiçek - v2.1.2

Written by Federico Pereiro (fpereiro@gmail.com) and released into the public domain.

To run the example first run `node example` at the command prompt and then open the url `localhost:8000` with your browser.
*/

(function () {

   // *** SETUP ***

   var isNode = typeof exports === 'object';
   var dale   = isNode ? require ('dale')   : window.dale;
   var teishi = isNode ? require ('teishi') : window.teishi;
   var type   = teishi.t;

   if (isNode) {

      var cicek  = isNode ? require ('./cicek.js') : undefined;
      var log    = teishi.l;
      var reply  = cicek.reply;
      var fs     = require ('fs');

      var echo = function (request, response) {

         if (response.offset === 0) {
            cicek.out ('Passing through common route.');
            return response.next ();
         }

         request.data.body = request.body;

         if (request.data.files) {
            fs.readFile (request.data.files [dale.keys (request.data.files) [0]], 'utf8', function (error, data) {
               if (error) return reply (response, 500, error);
               request.data.fileContent = data;
               reply (response, 200, JSON.stringify (request.data, null, '   '), 'json');
            });
         }
         else reply (response, 200, JSON.stringify (request.data, null, '   '), 'json');

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

      cicek.listen (8000, {log: 'cicek.log', cookieSecret: 'c0okies3cret'}, [
         ['all', '*', echo],
         ['get', '/', reply, dale.do (['https://code.jquery.com/jquery-2.1.4.js', 'files/dale.js', 'files/teishi.js', 'files/example.js'], function (v) {return '<script src="' + v + '"></script>'}).join (''), 'html'],
         ['get', 'files/(*)', cicek.file, ['.', 'node_modules/dale', 'node_modules/teishi/']],
         ['get', ['therats/(*)', 'fileswithdots/(*)'], cicek.file, ['node_modules/dale', 'node_modules/teishi/'], true],
         ['get', [/regex\/capt(u+)re(s)?/i, 'string/capt(u+)re(s)?', '/:first/:second/:third'], echo],
         ['post', ['data', 'upload'], echo],
         ['get', 'upload', reply, '<html><form action="upload" method="post" enctype="multipart/form-data"><input name="field1" value="field1"><input name="field2" value="field2"><input type="file" name="file1"><input type="file" name="file2"><input type="submit" value="Upload file"></form></html>', 'html'],
         ['get', 'data', reply, '<html><form action="data" method="post"><input name="field1" value="field1"><input name="field2" value="field2"><input type="submit" value="Send data"></form></html>', 'html'],
         [
            ['get', 'cookieSet', cookieSet],
            ['get', 'cookieDelete', cookieDelete]
         ]
      ]);
   }

   else {
      $ (function () {

         $ ('body').css ({'background-color': 'black', color: 'white'}).append ('<pre id="test"></pre>');

         var log = function () {
            var output = '\n';

            var inner = function (v) {
               if (teishi.simple (v)) return output += v + ' ';
               dale.do (v, function (v2) {
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

         var tests = [
            ['Get a file from another directory', 'get', 'files/dale.js'],
            ['Check that dots are not enabled by default in file serving', 'get', encodeURIComponent ('files/../id_rsa'), 400],
            ['Get file with dots in path where possible', 'get', encodeURIComponent ('fileswithdots/../../cicek.js'), 200, function (data, response) {
               state.etag = response.getResponseHeader ('etag');
               return true;
            }],
            ['Check etags for files', 'get', function (state) {return {'if-none-match': state.etag}}, encodeURIComponent ('fileswithdots/../../cicek.js'), 304],
            ['Invalid headers', 'get', {'noncompliant': 'header'}, 'anypath', 400],
            ['No such path', 'get', 'anypath', 404],
            ['Try other method for that path', 'put', 'files/dale.js', 405],
            ['Invalid json', 'post', {'content-type': 'application/json'}, 'data', 400],
            ['Valid json', 'post', {'content-type': 'application/json'}, 'data', '{"much": "data"}', 200, function (data) {
               // This problem only affects Firefox
               if (typeof data.body === 'string') data.body = JSON.parse (data.body);

               return data && data.body && data.body.much === 'data';
            }],
            ['Invalid url', 'post', 'data%', '---', 400],
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
            ['Cookie set', 'get', 'cookieSet'],
            ['Check cookie and tamper it', 'get', '/param1/param2/param3', function (data) {
               if (data.cookie.rat !== 'salad') return false;
               document.cookie = ('rat=somesalad');
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
            }]
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

            log ('Testing:', tag);

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
                  response.responseText = teishi.p (response.responseText);
               }
               if (response.status !== code || (check && ! check (response.responseText, response))) {
                  if (response.status !== code) log ('Expecting code', code, 'but received code', response.status);
                  else                          log ('Check function not passed!');
                  return log ('\n<b style="color: red">There was an error in test "' + tag + '". Aborting.</b>');
               }
               if (tests.length > 0) return doTest ();
               log ('\n<b style="color: green">All tests were successful!</b>');
               teishi.l ('done');
            });
         }

         doTest ();

      });
   }

}) ();
