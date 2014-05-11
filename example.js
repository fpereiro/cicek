var cicek = require ('./cicek');

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
