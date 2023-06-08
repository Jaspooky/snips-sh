.PHONY: clean dependencies publish

clean:
	rm -rf dist

dependencies:
	npm ci

publish: dependencies clean
	npm run build
	cp package.json README.md LICENSE dist
	cd dist && npm publish
