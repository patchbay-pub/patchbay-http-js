const http = require('../../');

const srv = http.createServer((req, res) => {
  console.log(req);
  res.write("Hi there");
  res.end();
});

srv.setPatchbayServer('https://beta.patchbay.pub');
//srv.setPatchbayServer('http://localhost:9001');
srv.setPatchbayChannel('/test');

srv.listen(3000);
