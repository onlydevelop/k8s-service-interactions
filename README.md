# K8S Service Interactions
This is just an example of a K8S service interacting with another K8S service. To show that, we have created a back and a front service, both from the same docker image. However, the only difference is the front service actually points to the back service. So, when we call the normal service with '/' endpoint, it will return the current service's details like hostname, version and if we call the service with '/service' endpoint, it will give the remote service's details. The difference is created through the environment variables passed to the configuration of the services in the deployment-*yaml.

## Application

This is a simple nodejs application (quick to write) as follows. Disclaimer: This is a raw POC so, things might not be optimised as per standard production code.

```javascript
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
```

If you are interested to see how it works. Just run it using node:

```
$ node service.js &
[1] 5415
Example app listening on port 3000!

$ curl localhost:3000
{"host":"dipanjan-machine","version":"1.0","port":3000,"remotePort":80}%
```
## Dockerfile

```dockerfile
FROM node:alpine3.10
RUN npm install express
WORKDIR /app
ADD ./service.js /app
EXPOSE 3000
ENTRYPOINT [ "node", "service.js" ]
```
We are simply creating the docker image from this Dockerfile.

First, we need to change the context to the minikube cluster.
```
$ eval $(minikube docker-env)
```

Then, we will build the docker image, so that it is available to minikube k8s cluster.
```bash
$ docker build -t backend:1.0 .
Sending build context to Docker daemon  45.17MB
Step 1/6 : FROM node:alpine3.10
 ---> fad0e15c010d
Step 2/6 : RUN npm install express
 ---> Using cache
 ---> 93e541817fad
Step 3/6 : WORKDIR /app
 ---> Using cache
 ---> 9707bb396179
Step 4/6 : ADD ./service.js /app
 ---> Using cache
 ---> 79192b75f24a
Step 5/6 : EXPOSE 3000
 ---> Using cache
 ---> d197f7efa1de
Step 6/6 : ENTRYPOINT [ "node", "service.js" ]
 ---> Using cache
 ---> 07ed725f0007
Successfully built 07ed725f0007
Successfully tagged backend:1.0
```
## Deployment

We actually created a Makefile so that we can run it with ease. If you are not in a unix based system, you can copy the commands from Makefile and run manually or create an equivalent script file for your os.

```makefile
create:
	kubectl apply -f deployment-back.yaml
	kubectl apply -f service-back.yaml
	kubectl apply -f deployment-front.yaml
	kubectl apply -f service-front.yaml
destroy:
	kubectl delete -f service-front.yaml
	kubectl delete -f deployment-front.yaml
	kubectl delete -f service-back.yaml
	kubectl delete -f deployment-back.yaml
```

And using Makefile it is just simply running:


```bash
$ make create # to create the deployments/services
kubectl apply -f deployment-back.yaml
deployment.apps/back-deployment unchanged
kubectl apply -f service-back.yaml
service/back-service unchanged
kubectl apply -f deployment-front.yaml
deployment.apps/front-deployment unchanged
kubectl apply -f service-front.yaml
service/front-service unchanged
```
or

```bash
make destroy # to destroy the deployments/services
kubectl delete -f service-front.yaml
service "front-service" deleted
kubectl delete -f deployment-front.yaml
deployment.apps "front-deployment" deleted
kubectl delete -f service-back.yaml
service "back-service" deleted
kubectl delete -f deployment-back.yaml
deployment.apps "back-deployment" deleted
```

## Checking the DNS resolution

If kube-dns is running properly, you should not have any issue in this step. In case, there is some issue you can see [Debugging DNS Resolution](https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/) from kubernetes standard documentation.

We can see the clusterIPs of the services:

```
$ kubectl get service
NAME            TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
back-service    NodePort    10.98.194.188   <none>        3000:32203/TCP   14m
front-service   NodePort    10.99.98.104    <none>        3000:30535/TCP   14m
kubernetes      ClusterIP   10.96.0.1       <none>        443/TCP          3d2h
```

To test, we will create a pod from where we can test the dns queries.

For the first time you need to create it:
```bash
$ kubectl run curl --image=radial/busyboxplus:curl -i --tty
```
Next time, you want to reattach, you need to use:
```bash
$ kubectl attach curl-66bdcf564-sbqtd -c curl -i -t
```
I have already created it. So, let me re-attach.
```
$ kubectl attach curl-66bdcf564-sbqtd -c curl -i -t
If you don't see a command prompt, try pressing enter.
[ root@curl-66bdcf564-sbqtd:/ ]$ nslookup back-service
Server:    10.96.0.10
Address 1: 10.96.0.10 kube-dns.kube-system.svc.cluster.local

Name:      back-service
Address 1: 10.98.194.188 back-service.default.svc.cluster.local
[ root@curl-66bdcf564-sbqtd:/ ]$ nslookup front-service
Server:    10.96.0.10
Address 1: 10.96.0.10 kube-dns.kube-system.svc.cluster.local

Name:      front-service
Address 1: 10.99.98.104 front-service.default.svc.cluster.local
[ root@curl-66bdcf564-sbqtd:/ ]$ nslookup front-service.default
Server:    10.96.0.10
Address 1: 10.96.0.10 kube-dns.kube-system.svc.cluster.local

Name:      front-service.default
Address 1: 10.99.98.104 front-service.default.svc.cluster.local
```
You will note that it resolves the service name `front-service` or `back-service`. So, as we are deploying both of them to the `default` namespace and will be accessing them from the same `default` namespace, we can just write the service name. From a different namespace we need to write that as `front-service.default`. There are kubernetes official documentations which you can refer to know more about it.

## Calling the service

Now, let's call the service from the pod. Note that, calling the front-service with '/service' endpoint gives the result of the back service.

```bash
[ root@curl-66bdcf564-sbqtd:/ ]$ curl http://back-service:3000/
{"host":"back-deployment-6c847dc546-l8l5l","version":"1.0","port":3000,"remotePort":80

[ root@curl-66bdcf564-sbqtd:/ ]$ curl http://front-service:3000/
{"host":"front-deployment-6c4d979b77-sbrwt","version":"2.0","port":3000,"remoteServiceName":"back-service","remotePort":"3000"}

[ root@curl-66bdcf564-sbqtd:/ ]$ curl http://front-service:3000/service
{"host":"back-deployment-6c847dc546-l8l5l","version":"1.0","port":3000,"remotePort":80}
```

Finally, let's call the service from our host machine. For that, we need to know which NodePort our service is running and the IP for the minikube VM so that we can connect to that.

```bash
$ minikube ip
192.168.99.101

$ kubectl get pods
NAME                                READY   STATUS    RESTARTS   AGE
back-deployment-6c847dc546-l8l5l    1/1     Running   0          21m
curl-66bdcf564-sbqtd                1/1     Running   4          21h
front-deployment-6c4d979b77-sbrwt   1/1     Running   0          21m

$ kubectl get service
NAME            TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
back-service    NodePort    10.98.194.188   <none>        3000:32203/TCP   14m
front-service   NodePort    10.99.98.104    <none>        3000:30535/TCP   14m
kubernetes      ClusterIP   10.96.0.1       <none>        443/TCP          3d2h
```

For accessing back service:
```bash
$ curl http://192.168.99.101:32203
{"host":"back-deployment-6c847dc546-l8l5l","version":"1.0","service":"backend", "port":3000,"remotePort":80}
```

For accessing front service:

```bash
$ curl http://192.168.99.101:30535
{"host":"front-deployment-6c4d979b77-sbrwt","version":"2.0","service":"frontend", "port":3000,"remoteServiceName":"back-service","remotePort":"3000"}                        

$ curl http://192.168.99.101:30535/service
{"host":"back-deployment-6c847dc546-l8l5l","version":"1.0","service":"backend", "port":3000,"remotePort":80}
```

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