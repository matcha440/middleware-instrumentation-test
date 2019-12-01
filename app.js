// trying out code found in this article.
// https://www.lunchbadger.com/blog/tracking-the-performance-of-express-js-routes-and-middleware/

const app = require('express')();
const bodyParser = require('body-parser');
const uuidv4 = require('uuid/v4');
const { EventEmitter } = require('events');

// Aggregate all profiler results into an event emitter to make
// handling the results generic
const profiles = new EventEmitter();

profiles.on('route', ({ req, elapsedMS }) => {
	console.log(req.id.toString(), req.method, req.url, `${elapsedMS}ms`);
});

profiles.on('middleware', ({ req, name, elapsedMS }) => {
	console.log(req.id.toString(), req.method, req.url, ':', name, `${elapsedMS}ms`);
});

app.use(wrap(function setId(req, res, next) {
	req.id = uuidv4();
	next();
}));

app.use(wrap(function block(req, res, next) {
	setTimeout(() => next(), 1000);
}));

app.use(wrap(bodyParser.json()));

app.post('*', wrap(function (req, res) {
	res.send('Hello, world!');
}));

app.listen(3000);

function wrap(fn) {
	// Function takes 2 arguments
	if (fn.length === 2) {
		return function (req, res) {
			const start = Date.now();
			res.once('finish', () => profiles.emit('route', {
				req,
				name: fn.name,
				elapsedMS: Date.now() - start
			}));
			return fn.apply(this, arguments);
		};
	} else if (fn.length === 3) {
		return function (req, res, next) {
			const start = Date.now();
			fn.call(this, req, res, function () {
				profiles.emit('middleware', {
					req,
					name: fn.name,
					elapsedMS: Date.now() - start
				});

				next.apply(this, arguments);
			});
		};
	} else {
		throw new Error('Function must take 2 or 3 arguments');
	}
}