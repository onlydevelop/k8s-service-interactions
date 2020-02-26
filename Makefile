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
create-1.1:
	kubectl apply -f endpoints-mongo.yaml
	kubectl apply -f service-mongo.yaml
	kubectl apply -f deployment-back-1.1.yaml
	kubectl apply -f service-back.yaml
	kubectl apply -f deployment-front-1.1.yaml
	kubectl apply -f service-front.yaml
destroy-1.1:
	kubectl delete -f service-front.yaml
	kubectl delete -f deployment-front-1.1.yaml
	kubectl delete -f service-back.yaml
	kubectl delete -f deployment-back-1.1.yaml
	kubectl delete -f service-mongo.yaml
