# Map Proxy #

A server that acts as a proxy to allow easy communication between clients.


## Running ##

- Install [node.js](http://nodejs.org/)
- Download latest map-proxy
  `$ npm install -g map-proxy`
- Run `$ map-proxy`
  - Run on an alternate port: `$ PORT=3456 map-proxy`


## Writing clients ##

You can write clients for [Protocol v1](docs/writing-clients-v1.md) or Protocol
v2 (work in progress).

Note that the Protocol v1 implementation wasn't particularly well implemented,
to the point where additions would require a complete rewrite of the code-base.
Protocol v2 (and the code-base of the reference implementation) will be designed
with extensibility in mind.
