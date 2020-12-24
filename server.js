const express = require('express');
const bodyParser = require('body-parser');
const session = require('cookie-session');
const assert = require('assert');
const mime = require('mime-types')

const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const fs = require('fs');

const mongourl = 'mongodb+srv://ou_cloud:1234@cluster0.0rsii.mongodb.net/project?retryWrites=true&w=majority';
const dbName = 'project';

const app = express();
const SECRETKEY = '';
const users = new Array(
	{name: 'demo', password: ''},
	{name: 'student', password: ''}
);

app.set('view engine', 'ejs');
app.set('trust proxy', 1);

app.use(bodyParser.json({limit:'50mb'}));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(express.static('public'));
app.use(session({
    name: 'loginSession',
    keys: [SECRETKEY]
  }));

app.get('/', async function(req,res) {
	if (!req.session.authenticated) {
		res.redirect('/login');
	} else {
		MongoClient.connect(mongourl, async function(err, db) {
			if (err) throw err;
			if(req.query.name != null && req.query.name != ""){
				var rn = await db.db(dbName).collection("restaurants").find({"name": {$regex : ".*"+req.query.name+".*"}}).toArray();
			}
			else if(req.query.borough != null && req.query.borough != ""){
				var rn = await db.db(dbName).collection("restaurants").find({"borough": {$regex : ".*"+req.query.borough+".*"}}).toArray();
			}	
			else if(req.query.boroughOrCuisine != null && req.query.boroughOrCuisine != ""){
				var rn = await db.db(dbName).collection("restaurants").find({ $or: [ {"borough": {$regex : ".*"+req.query.boroughOrCuisine+".*"}}, {"cuisine": {$regex : ".*"+req.query.boroughOrCuisine+".*"}}] });
			}else{
				var rn = await db.db(dbName).collection("restaurants").find({}).toArray();

			}	
			res.status(200).render('menu',{name: req.session.username, rlist: rn});
		});		
	}
});
app.get('/gmap', function(req,res) {
	res.status(200).render('gmap',{lat: req.query.lat, lon: req.query.lon});
});

app.get('/login', function(req,res) {
	res.status(200).render('loginPage',{});
});
app.get('/back', function(req,res) {
	res.redirect('/');
});

app.post('/login', function(req,res) {
	users.forEach((user) => {
		if (user.name == req.body.name && user.password == req.body.password) {
			req.session.authenticated = true;
			req.session.username = req.body.name;
		}
	});
	res.redirect('/');
});

app.get('/restaurant',function(req,res) {
	if (!req.session.authenticated) {
		res.redirect('/login');
	} else {
		MongoClient.connect(mongourl, async function(err, db) {
			if (err) throw err;
			var rn = await db.db(dbName).collection("restaurants").findOne({"restaurant_id": parseInt(req.query.id)});
			res.status(200).render('restaurant',{name: req.session.username, rlist: rn});
		});		
	}
});
app.get('/delrestaurant',function(req,res) {
	if (!req.session.authenticated ) {
		res.redirect('/login');
	} else {
		MongoClient.connect(mongourl, async function(err, db) {
			if (err) throw err;
			var rn = await db.db(dbName).collection("restaurants").deleteOne({ $and: [ {"owner": req.session.username}, {"restaurant_id": parseInt(req.query.id)}] });
			res.redirect('/');
		});		
	}
});
app.get('/new',function(req,res) {
    res.status(200).render('new',{});
});

app.post('/create', function(req,res) {
	var mine = "";
	switch(req.body.photo.charAt(0)){
		case '/': mine = "jpg";
			break;
		case 'i': mine = "png";
			break;
		case 'R': mine = "gif";
			break;
		case 'U': mine = "webp";
			break;
		default: mine = null;
	}
	var d = new Date();
	const restaurant = {
		'restaurant_id': d.getTime(),
		'name': req.body.name,
		'borough': req.body.borough,
		'cuisine': req.body.cuisine,
		'photo': req.body.photo,
		'photo mimetype': mine,
		'address': {
			'street': req.body.street,
			'building': req.body.building,
			'zipcode': req.body.zipcode,
			'coord': [req.body.lat, req.body.lon]
		},
		'grades': [],
		'owner': req.session.username
	};
	MongoClient.connect(mongourl, function(err, db) {
		if (err) throw err;
		db.db(dbName).collection("restaurants").insertOne(restaurant, function(err, res) {
			if (err) throw err;
			console.log("1 document inserted");
			db.close();
		});
	});
	res.redirect('/');
});

app.get('/edit',function(req,res) {
	if (!req.session.authenticated) {
		res.redirect('/login');
	} else {
		MongoClient.connect(mongourl, async function(err, db) {
			if (err) throw err;
			var rn = await db.db(dbName).collection("restaurants").findOne({"restaurant_id": parseInt(req.query.id)});
			res.status(200).render('edit',{name: req.session.username, rlist: rn});
		});		
	}
});

app.post('/update', function(req,res) {

	var mine = "";
	switch(req.body.photo.charAt(0)){
		case '/': mine = "jpg";
			break;
		case 'i': mine = "png";
			break;
		case 'R': mine = "gif";
			break;
		case 'U': mine = "webp";
			break;
		default: mine = null;
	}
	const restaurant = {
		'name': req.body.name,
		'borough': req.body.borough,
		'cuisine': req.body.cuisine,
		'photo': req.body.photo,
		'photo mimetype': mine,
		'address': {
			'street': req.body.street,
			'building': req.body.building,
			'zipcode': req.body.zipcode,
			'coord': [req.body.lat, req.body.lon]
		},
	};
	if (!req.session.authenticated && req.body.owner == req.session.username) {
		res.redirect('/login');
	} else {
		MongoClient.connect(mongourl, function(err, db) {
			if (err) throw err;
			db.db(dbName).collection("restaurants").updateOne({"restaurant_id": parseInt(req.body.restaurant_id)}, { $set: restaurant }, function(err, res) {
				if (err) throw err;
				console.log("1 document inserted");
				db.close();
			});
		});
	}
	res.redirect('/');
});

app.post('/rate', function(req,res) {
	if (!req.session.authenticated) {
		res.redirect('/login');
	} else {
		MongoClient.connect(mongourl, async function(err, db) {
			if (err) throw err;
			var rn = await db.db(dbName).collection("restaurants").findOne({"restaurant_id": parseInt(req.body.restaurant_id)});
			var done = false;
			for(var i = 0; i < rn.grades.length;i++){
				if(rn.grades[i]['user'] == req.session.username){
					rn.grades[i]['score'] = req.body.rate;
					MongoClient.connect(mongourl, function(err, db) {
						if (err) throw err;
						db.db(dbName).collection("restaurants").updateOne({"restaurant_id": parseInt(req.body.restaurant_id)}, { $set: {"grades": rn.grades }}, function(err, res) {
							if (err) throw err;
							console.log("1 document inserted");
							db.close();
						});
					});	

					res.redirect('/');
					done = true;
				}
				
			}
			if(!done){
				rn.grades.push({"user": req.session.username , "score": req.body.rate})
				MongoClient.connect(mongourl, function(err, db) {
					if (err) throw err;
					db.db(dbName).collection("restaurants").updateOne({"restaurant_id": parseInt(req.body.restaurant_id)}, { $set: {"grades": rn.grades }}, function(err, res) {
						if (err) throw err;
						console.log("1 document inserted");
						db.close();
					});
					res.redirect('/');
				});	
			}
	
		});		
	}

	
	
});
app.get('/refresh',function(req,res) {
    res.redirect('/');
});

app.get('/logout',function(req,res) {
    req.session = null;
    res.redirect('/login');
});

const findDocument = (db, criteria, callback) => {
    let cursor = db.collection('restaurants').find(criteria);
    console.log(`findDocument: ${JSON.stringify(criteria)}`);
    cursor.toArray((err,docs) => {
        assert.strictEqual(err,null);
        console.log(`findDocument: ${docs.length}`);
        callback(docs);
    });
}

app.get('/api/restaurant/name/:name', (req,res) => {
    if (req.params.name) {
        let criteria = {};
        criteria['name'] = req.params.name;
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.strictEqual(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, criteria, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).json(docs);
            });
        });
    } else {
        res.status(500).json({"error": "missing bookingid"});
    }
})

app.get('/api/restaurant/borough/:borough', (req,res) => {
    if (req.params.borough) {
        let criteria = {};
        criteria['borough'] = req.params.borough;
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.strictEqual(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, criteria, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).json(docs);
            });
        });
    } else {
        res.status(500).json({"error": "missing bookingid"});
    }
})

app.get('/api/restaurant/cuisine/:cuisine', (req,res) => {
    if (req.params.cuisine) {
        let criteria = {};
        criteria['cuisine'] = req.params.cuisine;
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.strictEqual(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, criteria, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).json(docs);
            });
        });
    } else {
        res.status(500).json({"error": "missing bookingid"});
    }
})

app.listen(process.env.PORT || 8099);