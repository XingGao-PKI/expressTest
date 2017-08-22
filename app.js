const express =require('express')
const app =express();
const fs =require('fs')
const httpProxy = require('http-proxy');
const request = require('request');



const port = 8080;
const host = 'localhost';
const proxyTarget = "http://xxxxxx.xxxxxx.com";


function proxyRoute(hostStr, portStr, target, tokenStr) {
  const targetHost = target.replace(/^https?:\/\//, '');

  const proxy = httpProxy.createProxyServer({
    secure: false,
    hostRewrite: `${hostStr}:${portStr}`,
    protocolRewrite: 'http',
    changeOrigin: true,
    target: target
  });

  // For host rewrite to work 'host' header needs to be specified
  proxy.on('proxyReq', (proxyReq, req, res) => {
    proxyReq.setHeader('host', targetHost);
    proxyReq.setHeader('Referer', target);

    if (tokenStr) {
      proxyReq.setHeader('X-Authentication-Info', tokenStr);
    }

    proxyReq.on('response', (proxyRes) => {
      // Abort the request, if remote returned 404. This gives a chance
      // to the next middleware to handle the request
      //
      if (proxyRes.statusCode === 404) {
        proxyReq.abort();
        if (res.__http_proxy_next) {
          res.__http_proxy_next();
        }
      }
    });
  });

  // If no error handler is provided, then the application will
  // exit on the 1st error.
  //
  proxy.on('error', (err, req, res) => {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.write(`From NodeJS Server
    Proxied request failed.
    Url: ${req.url}
    ${JSON.stringify(err, null, 2)}`);
    res.end();
  });

  return (req, res, next) => {
    // Replace all 'secure' cookies with non-secure. 'Secure' cookies will
    // be invisible to the browser if connection is not secure. Our connection
    // is always HTTP.
    //
    res.oldWriteHead = res.writeHead;
    res.writeHead = function (statusCode, headers) {
      var cookies = res.getHeader('set-cookie');

      if (typeof cookies === 'string') {
        cookies = [cookies];
      }

      if (cookies) {
        cookies = cookies.map((cookie) => cookie.replace(/;\s*secure\s*;/gi, ';'));
        res.setHeader('set-cookie', cookies);
      }

      res.oldWriteHead(statusCode, headers);
    };
    // Remember next in the response object, so that we can call it to abort the request.
    res.__http_proxy_next = next;
    proxy.web(req, res);
  };
}

const proxyNew = proxyRoute(host, port, proxyTarget, null);

app.get('/',(req, res)=>{
  res.sendFile(__dirname + '/index.html')
})
app.all('/', proxyNew); // post request 
app.all('/*',proxyNew); // get request



app.listen(8080, function () {
  console.log('Example app listening on port 8080!')
})

app.use(function (req, res, next) {
  res.status(404).send("Sorry can't find that!")
})
