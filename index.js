"use strict"

const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const _ = require('lodash');
var cors = require('cors')

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
}

const genUrl = (id) => "https://search-api.migros.ch/products?lang=fr&key=migros_components_search&limit=10&offset=0&q=" + id;

class Reduction {
  constructor(mode , text, value) {
    this.mode = mode;
    this.value = value;
    this.text = text;
  }
}

class Product {
  constructor(data) {
    Object.assign(this, data);
    this.reductions = [];
  }

  addReduction(red) {
    this.reductions.push(red);
  }
}

const cache = {};

const getDataFromId = (id) => {
  if (!cache[id]) {
    cache[id] = new Promise((resolve, reject) => {
      request.get(genUrl(id), (err, res, body) => {
        if (err) {
          reject(err);
        } else {
          const data = JSON.parse(body);
          if (data.total_hits < 1) {
            reject("no result");
          }
          const result = data.results[0];
          result.price = result._product.price;
          result.id = id;
          result.reductions
          delete result._product;
          resolve(new Product(result));
        }
      });
    });
  }
  return cache[id];
};


var specialOffers = [
  {
    reduction: new Reduction('-', 'Offre Sweifel', 0.3),
    products: [7610095015006, 7617027064590]
  }
];

const percentages = {
  0: 0,
  1: 0,
  2: 5,
  3: 7.5,
  4: 10
}

const clone = (prods) => {
  return _.map(prods, (p) => {
    return _.cloneDeep(p);
  });
}

const reductionGroup = (prods) => {
  const ctr = Reduction.bind(null, '*', 'Groupped price');
  const counts = _.countBy(prods, 'id');
  prods.forEach((p) => {
    const c = counts[p.id];
    if (c > 1) {
      if (c < percentages.length) {
        p.addReduction(new ctr(percentages[c]))
      } else {
        p.addReduction(new ctr(percentages[_.keys(percentages).length - 1]));
      }
    }
  });
  return prods;
}

const specialApplier = (prods) => {
  try {
  _.each(specialOffers, (offer) => {
    const required = offer.products;
    const canApply = _.every(required, (r) => {
      return _.find(prods, {id: r});
    });
    if (canApply) {
      const applyTo = _.find(prods, {id: required[0]})
      applyTo.addReduction(offer.reduction);
    }
  });
  } catch(e) {
    console.log(e);
  }
  return prods;
}

const perishingSoon = (prods) => {
  _.each(prods, (p) => {
    if (p.id === 22016287) {
      p.addReduction(new Reduction('*', 50, 'This product is getting old'));
    }
  });
  return prods;
}


var app = express();
app.use(bodyParser.json());
app.use(cors());


app.get('/', function (req, res, next) {
  res.json({});
});
app.post('/', function (req, res, next) {
  if (req.body && req.body.length > 0) {
    Promise.all(req.body.map(getDataFromId))
    .then(clone)
    .then(specialApplier)
    .then(reductionGroup)
    .then(perishingSoon)
    .then((p) => {
      res.json(p);
    })
    .catch((e) => {
      console.log('ERROR');
      console.log(e);
    });
  } else {
    res.json([]);
  }
});

app.listen(80, function () {
    console.log('Example app listening on port 80!');
});

