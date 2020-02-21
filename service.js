const express = require('express')
const https = require('http')
const os = require("os");
const app = express();
const port = process.env.PORT || 3000;
const remotePort = process.env.REMOTE_PORT || 80;
const version = process.env.VERSION || "1.0";
const hostname = os.hostname();
const serviceName = process.env.SERVICE;
const remoteServiceName = process.env.REMOTE_SERVICE;

var res = {
	host: hostname, 
	version: version, 
	service: serviceName, 
	port: port, 
	remoteServiceName: remoteServiceName,
	remotePort: remotePort
};
var response = JSON.stringify(res);

app.get('/', (req, res) => res.send(response));
app.get('/service', (req, res) => {
	https.get('http://'+remoteServiceName+':'+remotePort+'/', (resp) => {
		let data = '';
		resp.on('data', (chunk) => {
			data += chunk;
	    });	

		resp.on('end', () => {
    		res.send(data);
  		});
	}).on('error', (err) => {
  		console.log("Error: " + err.message);
	});
});
app.listen(port, () => console.log(`Example app listening on port ${port}!`));

