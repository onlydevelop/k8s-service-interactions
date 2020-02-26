# Accessing a service outside the cluster

This is created on top of the service created in the previous section. In case, you are interested, you can refer the [part1](README-part1.md) of the application.

## Adding external service

Next, we would be adding an external service. For this, I have created a mongodb service in [mlab](https://mlab.com/home), which is a nice free service if you want to experiment with a mongodb database.

Here, we must note that mongodb gives and URL and a port for the service to be connected. So, we need to create an endpoint first for the mongodb and then put a service pointing to the endpoint.

>There is an excellent [blog](https://cloud.google.com/blog/products/gcp/kubernetes-best-practices-mapping-external-services) about different options of adding an external service to kubernetes. I would recommend to read it as it describes the concept very clearly.

First, we would create the endpoint and service for mongodb. Here the IP address can be found by nslookup for the mlab database host name and port is the mlab database port which is specified in mlab page.

endpoints-mongo.yaml
```yaml
kind: Endpoints
apiVersion: v1
metadata:
 name: mongo
subsets:
 - addresses:
     - ip: 54.91.243.222
   ports:
     - port: 59200
```

The service is created with the targetPort of 59200 which is exposed by the mongo endpoint above and 27017 is the default port for mongodb.

service-mongo.yaml
```yaml
kind: Service
apiVersion: v1
metadata:
 name: mongo
spec:
 ports:
 - port: 27017
   targetPort: 59200

```

Now, we have created a config files in the /config directory. You can see there is a default.json. You need to create the prod.json in the same directory and populate the values with the actual production datbase credentials and database name. Config file looks like as follows:

default.json
```json
{
    "DBName": "mydb",
    "DBUser": "fakeuser",
    "DBPassword": "fakepassword"
}
```

This is actualy read by the config module in service.js as follows:

```javascript
...
const config = require('config');

const dbhost = "mongodb://" + config.DBUser + ":" + config.DBPassword + "@mongo/" + config.DBName
...
```

And we are reading the values(`version` and `env`) from the database as follows:

```javascript
...
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
...
```

For this change, we have built the docker images with version 1.1.

```
$ docker build -t backend:1.1 .
```

And we have created two new set of deployment yaml files with the updated docker images. 

> Please note that, in order to make the js code to pick up the value from `config/prod.json` we have to add an additional env var `NODE_ENV` which is set to `prod` the same as of the json file name.

We have also made the name of the collection same as specified in the env var `SERVICE` so that, using the same variable we can read two different collection using the same image for the service.

deployment-back-1.1.yaml
```yaml
kind: Deployment
apiVersion: apps/v1
metadata:
  name: back-deployment
  labels:
    app: back
spec:
  replicas: 1
  selector:
    matchLabels:
      app: back
  template:
    metadata:
      labels:
        app: back
    spec:
      containers:
      - name: back
        image: backend:1.1
        ports:
        - containerPort: 3000
        env:
        - name: VERSION
          value: "1.0"
        - name: SERVICE
          value: "backend"
        - name: NODE_ENV
          value: "prod"
```

and

deployment-front-1.1.yaml
```yaml
kind: Deployment
apiVersion: apps/v1
metadata:
  name: front-deployment
  labels:
    app: front
spec:
  replicas: 1
  selector:
    matchLabels:
      app: front
  template:
    metadata:
      labels:
        app: front
    spec:
      containers:
      - name: front
        image: backend:1.1
        ports:
        - containerPort: 3000
        env:
        - name: REMOTE_SERVICE
          value: "back-service"
        - name: REMOTE_PORT
          value: "3000"
        - name: VERSION
          value: "2.0"
        - name: SERVICE
          value: "frontend"
        - name: NODE_ENV
          value: "prod"
```

So, to deploy this we have made additional section for mongodb and the new services in the Makefile and named under `create-1.1` and `destroy-1.1`.

Now, we deploy the app (please delete the app using `make destroy` if you have created that earlier).

```bash
$ make create-1.1
kubectl apply -f endpoints-mongo.yaml
endpoints/mongo created
kubectl apply -f service-mongo.yaml
service/mongo created
kubectl apply -f deployment-back-1.1.yaml
deployment.apps/back-deployment created
kubectl apply -f service-back.yaml
service/back-service created
kubectl apply -f deployment-front-1.1.yaml
deployment.apps/front-deployment created
kubectl apply -f service-front.yaml
service/front-service created
```

Now, lets check if things are running properly:

```bash
$ kubectl get svc
NAME            TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)          AGE
back-service    NodePort    10.98.52.115     <none>        3000:32649/TCP   18s
front-service   NodePort    10.108.232.216   <none>        3000:31651/TCP   17s
kubernetes      ClusterIP   10.96.0.1        <none>        443/TCP          8d
mongo           ClusterIP   10.97.213.63     <none>        27017/TCP        18s

$ curl 192.168.99.101:32649
{"host":"back-deployment-85588f66f7-dk8cf","version":"1.1","service":"backend","port":3000,"remotePort":80,"env":"dev"}

$ curl 192.168.99.101:31651
{"host":"front-deployment-844b8d6df6-rt5v4","version":"2.1","service":"frontend","port":3000,"remoteServiceName":"back-service","remotePort":"3000","env":"qa"}

$ curl 192.168.99.101:31651/service
{"host":"back-deployment-85588f66f7-dk8cf","version":"1.1","service":"backend","port":3000,"remotePort":80,"env":"dev"}
```

Finally, destory the app, using:

```bash
$ make destroy-1.1
kubectl delete -f service-front.yaml
service "front-service" deleted
kubectl delete -f deployment-front-1.1.yaml
deployment.apps "front-deployment" deleted
kubectl delete -f service-back.yaml
service "back-service" deleted
kubectl delete -f deployment-back-1.1.yaml
deployment.apps "back-deployment" deleted
kubectl delete -f service-mongo.yaml
service "mongo" deleted
```