const express = require('express')
const https = require('http')
const os = require("os");
const app = express();
const port = process.env.PORT || 3000;
const remotePort = process.env.REMOTE_PORT || 80;
const hostname = os.hostname();
const serviceName = process.env.SERVICE;
const remoteServiceName = process.env.REMOTE_SERVICE;
const mongoClient = require('mongodb').MongoClient;
const config = require('config');

const dbhost = "mongodb://" + config.DBUser + ":" + config.DBPassword + "@mongo/" + config.DBName

app.get('/', (req, res) => {
	mongoClient.connect(dbhost, {useUnifiedTopology: true}, function(err, db) {
		if (err) throw err;

		var dbo = db.db(config.DBName);
		var version = process.env.VERSION || "1.0";
		var env = "";

		dbo.collection(serviceName).findOne({}, function(err, result) {
			if (err) throw err;
			version = result.version;
			env = result.env;
			db.close();

			var response = {
				host: hostname,
				version: version,
				service: serviceName,
				port: port,
				remoteServiceName: remoteServiceName,
				remotePort: remotePort,
				env: env
			};

			res.send(JSON.stringify(response));
		});
	});
});

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
