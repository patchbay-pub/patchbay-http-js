const https = require('https');
//const https = require('http');
const stream = require('stream');
const EventEmitter = require('events');

const requestPrefix = 'pb-h-';
const responsePrefix = 'pb-h-';

class Server extends EventEmitter {
  constructor() {
    super();

    if (arguments.length === 1) {
      this._handler = arguments[0];
    }
    else if (arguments.length === 2) {
      this._handler = arguments[1];
    }

    this.patchbayServer = 'patchbay.pub';
    this.patchbayChannel = '/';
    this.numWorkers = 1;
  }

  listen() {
    for (let i = 0; i < this.numWorkers; i++) {
      this.listenWorker(i);
    }
  }

  async listenWorker(index) {
    const rootUrl = this.patchbayServer + '/res' + this.patchbayChannel + '?switch=true';

    const runLoop = async () => {
      while (true) {
        const randomChannelId = genRandomChannelId();

        const switchResponse = await new Promise((resolve, reject) => {
          const switchRequestOptions = {
            method: 'POST',
          };

          if (this._authToken) {
            switchRequestOptions.headers = {
              'Pb-Token': this._authToken,
            };
          }

          const switchRequest = https.request(rootUrl, switchRequestOptions, (res) => {
            resolve(res);
          });

          switchRequest.on('error', (e) => {
            console.error("Switch request error");
            console.error(e);
            // TODO: Will this leak memory from recursion?
            setTimeout(runLoop, 3000);
          });

          switchRequest.write(randomChannelId);
          switchRequest.end();
        });

        //const res = new stream.PassThrough();

        const res = await new Promise((resolve, reject) => {
          const url = this.patchbayServer + '/' + randomChannelId;
          const serveRequest = https.request(url, {
            method: 'POST'
          }, (res) => {
            // must consume according to node docs
            res.resume();
            //resolve(res);
          });

          resolve(serveRequest);
          //res.pipe(serveRequest);
        });
        
        res.on('error', (e) => {
          console.error("Generic res error");
          console.error(e);
        });
        
        if (this._authToken) {
          res.setHeader('Pb-Token', this._authToken);
        }

        const oldSetHeader = res.setHeader;
        res.setHeader = function(name, value) {
          oldSetHeader.call(res, responsePrefix + name, value);
        };

        // When statusCode is set, set the appropriate patchbay header to pass
        // it through to the requester.
        Object.defineProperty(res, 'statusCode', {
          set: function(val) {
            //this.setHeader('Pb-Status', String(val));
            oldSetHeader.call(res, 'Pb-Status', String(val));
          }
        });

        const resHeaders = {};

        for (const headerName of Object.keys(switchResponse.headers)) {
          if (headerName.startsWith(requestPrefix)) {
            resHeaders[headerName.slice(requestPrefix.length)] = switchResponse.headers[headerName];
          }
        }

        // TODO: might need to inherit from http.IncomingMessage
        const req = {
          headers: resHeaders,
          method: switchResponse.headers['pb-method'],
          url: switchResponse.headers['pb-uri'],
          on: switchResponse.on.bind(switchResponse),
        };

        if (this._handler) {
          this._handler(req, res);
        }

        this.emit('request', req, res);
      }
    };

    await runLoop();
  }

  setPatchbayServer(server) {
    this.patchbayServer = server;
  }

  setPatchbayChannel(channelId) {
    if (!channelId.startsWith('/')) {
      throw new Error("Invalid channelId");
    }
    this.patchbayChannel = channelId;
  }

  setNumWorkers(numWorkers) {
    this.numWorkers = numWorkers;
  }

  setAuthToken(token) {
    this._authToken = token;
  }
}

function createServer() {
  return new Server(...arguments);
}

function genRandomChannelId() {
  const possible = "0123456789abcdefghijkmnpqrstuvwxyz";

  function genCluster() {
    let cluster = "";
    for (let i = 0; i < 32; i++) {
      const randIndex = Math.floor(Math.random() * possible.length);
      cluster += possible[randIndex];
    }
    return cluster;
  }

  let id = "";
  id += genCluster();
  //id += '-';
  //id += genCluster();
  //id += '-';
  //id += genCluster();
  return id;
}
module.exports = {
  createServer
};
