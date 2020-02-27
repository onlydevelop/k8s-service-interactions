# Using ingress

This is created on top of the service created in the previous section. In case, you are interested, you can refer the [part1](README-part1.md) of the application.

## Adding ingress

In this section we will see the ingress experiments done within the minikube installation. 

## Enabling ingress in minikube

The simple command you need to issue to enable ingress in minukube is:

```
$ minikube addons enable ingress
```

## What we will do

We will create an ingress resource which will do following things: 

1. It will create two host based entries myexample1.com and myexample2.com. So, that we can see the requests are routed based on hosts.
2. It will create a fanout so that, myexample1.com/front-service sends the traffic to front-service and the myexample.com/back-service will send the traffic to back-service.

And finally, we will increase the replica count of the front service to see the traffics are load balanced using the ingress+service combination.

## Ingress configuration

The ingress resource looks like the following. Here we see that under `spec.rules` there are two hosts - myexample1.com and myexample2.com, which will be used for host based routing. And then, within myexample1.com we have two `paths`, which are `/back-service` pointing to back-service and `/front-service` pointing to front-service.

ingress.yaml
```yaml
apiVersion: networking.k8s.io/v1beta1
kind: Ingress
metadata:
  name: simple-service
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: myexample1.com
    http:
      paths:
      - path: /back-service
        backend:
          serviceName: back-service
          servicePort: 3000
      - path: /front-service
        backend:
          serviceName: front-service
          servicePort: 3000
  - host: myexample2.com
    http:
      paths:
      - path: /
        backend:
          serviceName: back-service
          servicePort: 3000

```

Now, we will deploy it using `make create-1.2`:

```bash
$ make create-1.2
kubectl apply -f deployment-back.yaml
deployment.apps/back-deployment created
kubectl apply -f service-back.yaml
service/back-service created
kubectl apply -f deployment-front.yaml
deployment.apps/front-deployment created
kubectl apply -f service-front.yaml
service/front-service created
kubectl apply -f ingress.yaml
ingress.networking.k8s.io/simple-service created
```

Next, we need to add the resolution of our fake domain names to out /etc/hosts.

```
$ cat /etc/hosts
cat /etc/hosts
127.0.0.1	localhost
...
192.168.99.101	myexample1.com myexample2.com
...
```

To make sure we can nslookup myexample1.com, which we see resolves correctly:

```bash
$ nslookup myexample1.com
Server:		127.0.0.53
Address:	127.0.0.53#53

Non-authoritative answer:
Name:	myexample1.com
Address: 192.168.99.101
```

Now, we will check the ingress.

```bash
$ curl myexample1.com/back-service
{"host":"back-deployment-7cc67f4476-jffjf","version":"1.0","service":"backend","port":3000,"remotePort":80}

$ curl myexample1.com/front-service
{"host":"front-deployment-6d858bf675-tqpw7","version":"2.0","service":"frontend","port":3000,"remoteServiceName":"back-service","remotePort":"3000"}

$ curl myexample2.com/
{"host":"back-deployment-7cc67f4476-jffjf","version":"1.0","service":"backend","port":3000,"remotePort":80}
```

So far, so good. Now, finally we will see the load balanced traffic by increasing the replica count of front service to 3 and re-running `make create-1.2`:

```bash
$ kubectl get deployments
NAME               READY   UP-TO-DATE   AVAILABLE   AGE
back-deployment    1/1     1            1           6m17s
front-deployment   3/3     3            3           6m17s

$ kubectl get pods
NAME                                READY   STATUS             RESTARTS   AGE
back-deployment-7cc67f4476-jffjf    1/1     Running            0          9m15s
front-deployment-6d858bf675-4c6vg   1/1     Running            0          3m27s
front-deployment-6d858bf675-mjmvw   1/1     Running            0          3m27s
front-deployment-6d858bf675-tqpw7   1/1     Running            0          9m15s
```

We note that the front deployment has 3 pods available. Now, we will access the front service multiple times.

```bash
$ curl myexample1.com/front-service
{"host":"front-deployment-6d858bf675-4c6vg","version":"2.0","service":"frontend","port":3000,"remoteServiceName":"back-service","remotePort":"3000"}

$ curl myexample1.com/front-service
{"host":"front-deployment-6d858bf675-tqpw7","version":"2.0","service":"frontend","port":3000,"remoteServiceName":"back-service","remotePort":"3000"}

$ curl myexample1.com/front-service
{"host":"front-deployment-6d858bf675-mjmvw","version":"2.0","service":"frontend","port":3000,"remoteServiceName":"back-service","remotePort":"3000"}%
```

So, finally we see that the traffic is load balanced between different pods.