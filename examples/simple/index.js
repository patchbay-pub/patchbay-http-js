const http = require('../../');
const url = require('url');
const fs = require('fs');
const path = require('path');

const rootChannel = '/test';

const srv = http.createServer(async (req, res) => {
  console.log(req);

  const urlParts = url.parse(req.url);
  console.log(urlParts);

  const rootDir = './';

  try {
    const filePath = path.join(rootDir, urlParts.pathname.slice(rootChannel.length));
    const stats = await fs.promises.stat(filePath);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
  catch (e) {
    console.error(e);
    res.write("Fail");
    res.end();
  }
});

srv.setPatchbayServer('https://beta.patchbay.pub');
//srv.setPatchbayServer('http://localhost:9001');
srv.setPatchbayChannel(rootChannel);

srv.listen(3000);
