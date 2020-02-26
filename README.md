# K8S Service Interactions
In this repository we are trying to explore the interaction of services running in a kubernetes cluster and interactions / accessing them. For the sake of structure, the README is divided into multiple parts so that each part focuses on a specific topic.

## Part 1: Interaction between two services in the same cluster

In this section we are going to access one back-service from another front-service in the same namespace in the same kubernetes cluster. Read [more...](README-part1.md)

## Part 2: Accessing a service outside the cluster

We have extended the above example to connect to an external mongodb database from one of the service in the kubernetes cluster. Read [more...](README-part2.md)
