"use strict";

var iotagent = require('dojot-iotagent');
var express = require('express');
var bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json()); // for parsing application/json

const iota = new iotagent.IoTAgent();

var knownBeacons = {};


/* Initializes iotagent library, allowing us to receive notifications from dojot */
iota.init();

/*
  The following iota calls may be used for initializing the agent.
  Here, they do nothing but print existing device data
*/
iota.listTenants()
      .then((tenants) => {
        for (let t of tenants) {
          iota.listDevices(t, {}).then((devices) => {
            console.log('got device list for [%s]', t, devices);
            for (let d of devices) {
              iota.getDevice(d, t).then((deviceinfo) => {
                for (let tpl in deviceinfo.attrs) {
                  for (let attr of deviceinfo.attrs[tpl]) {
                    if (attr.label == "address") {
                      knownBeacons[`${t}:${attr.static_value}`] = d;
                    }
                  }
                }
                // console.log(' --- Device config for (%s)\n', d, deviceinfo);
              })
            }
          })
        }
      })
      .catch((error) => {console.error(error)});

/*
  The following exemplifies registering action callbacks from dojot (device manager).
  Again, this does nothing but print the id of the updated device.
*/
iota.on('device.create', (event) => {
  // console.log('device [%s] created', JSON.stringify(event))
  const tenant = event.meta.service;
  for (let template in event.data.attrs) {
    for (let attr of event.data.attrs[template]) {
      if (attr.label == 'address') {
        const key = `${tenant}:${attr.static_value}`
        knownBeacons[key] = event.data.id;
      }
    }
  }
  // console.log('knownBeacons', JSON.stringify(knownBeacons));
});

iota.on('device.update', (event) => {
  // console.log('device [%s] updated', JSON.stringify(event))
  for (let oldKey in knownBeacons) {
    if (knownBeacons[oldKey] == event.data.id) {
      delete knownBeacons[oldKey];
    }

    const tenant = event.meta.service;
    for (let template in event.data.attrs) {
      for (let attr of event.data.attrs[template]) {
        if (attr.label == 'address') {
          const key = `${tenant}:${attr.static_value}`
          knownBeacons[key] = event.data.id;
        }
      }
    }
  }
  // console.log('knownBeacons', JSON.stringify(knownBeacons));
});

iota.on('device.remove', (event) => {
  // console.log('device [%s] removed', JSON.stringify(event))
  const tenant = event.meta.service;
  for (let template in event.data.attrs) {
    for (let attr of event.data.attrs[template]) {
      if (attr.label == 'address') {
        const key = `${tenant}:${attr.static_value}`
        if (knownBeacons.hasOwnProperty(key)) {
          delete knownBeacons[key];
        }
      }
    }
  }
  // console.log('knownBeacons', JSON.stringify(knownBeacons));
});

/* actual sample http/json iotagent implementation follows */

function handleData(req, res) {
  const data = req.body;
  const tenant = data.reader;

  for (let beacon of data.beacons) {
    const idSource = beacon.beaconAddress;
    const key = `${tenant}:${idSource}`
    let parsed = {
      instanceId: beacon.eddystoneUidData.instanceId,
      distance: beacon.distance,
      rssi: beacon.rssi,
      txPower: beacon.txPower
    }

    if (knownBeacons.hasOwnProperty(key)) {
      iota.updateAttrs(knownBeacons[key], tenant, parsed, {});
      console.log("beacon", tenant, JSON.stringify(parsed), "updating");
    } else {
      console.log("beacon", tenant, JSON.stringify(parsed), "ignoring");
    }
  }
  // const device = req.get('x-device-id');
  // if ((tenant === undefined)|| (device === undefined)) {
  //   return res.status(400).send({message: 'missing device and tenant information'});
  // }

  // console.log('got data', JSON.stringify(req.body));
  // iota.updateAttrs(device, tenant, req.body, {});
  return res.status(200).send();
}

app.post('/*', handleData)

app.listen(80, () => {console.log('--- iotagent running (port 80) ---')})
