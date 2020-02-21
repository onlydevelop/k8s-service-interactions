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
