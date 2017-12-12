'use strict';

const rpio = require('rpio');
const WindowCovering = require('./WindowCovering');

function PiRFPlatform(log, config, api) {
  this.log = log;
  this.config = config;

  // initialize WindowCoverings
  this.windowCoverings = {};
  this.config.windowCoverings.forEach(function(windowCoveringConfig) {
    this.windowCoverings[windowCoveringConfig.serialNumber] = new WindowCovering(this, windowCoveringConfig);
  }.bind(this));

  if (api) {
    // Save the API object as plugin needs to register new accessory via this object.
    this.api = api;

    // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories
    // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
    // Or start discover new accessories
    this.api.on('didFinishLaunching', this.registerAccessories.bind(this));
  }
};

PiRFPlatform.prototype.registerAccessories = function() {
  let newAccessories = [];
  
  // initialize windowCoverings accessories
  this.config.windowCoverings.forEach(function(windowCoveringConfig) {
    let windowCovering = this.windowCoverings[windowCoveringConfig.serialNumber];
    if (!windowCovering.hasRegistered()) {
      newAccessories.push(windowCovering.initializeAccessory());
    }
  }.bind(this));

  // collect all accessories after they have been initialized and register them with homebridge
  if (newAccessories.length > 0) {
    this.api.registerPlatformAccessories("homebridge-pirf", "PiRF", newAccessories);
  }  
};

// restore from persistent storage
PiRFPlatform.prototype.configureAccessory = function(accessory) {
  this.log("Restoring accessory: " + accessory.displayName);
  if (accessory.context.class == "WindowCovering") {
    const windowCovering = this.windowCoverings[accessory.context.id];
    windowCovering.setAccessory(accessory);
    windowCovering.setRegistered(true);
  }
  else {
    this.log('Accessory ' + accessory.displayName + ' is of an unknown class "' + accessory.context.class + '"');
  }
  accessory.updateReachability(true);
};

// transmit Radio Frequency code via GPIO
PiRFPlatform.prototype.transmit = function(code) {
  this.log("Transmitting RF code: " + code);
  const binaryCode = code.toString(2);
  const pin = this.config.pin;
  const repeat = this.config.repeat;

  rpio.open(pin, rpio.OUTPUT, rpio.LOW);

  for (var i=0; i<repeat; i++) {
    // sending sync pulse
    rpio.write(pin, rpio.HIGH);
    rpio.usleep(this.config.pulse.sync.high);
    rpio.write(pin, rpio.LOW);
    rpio.usleep(this.config.pulse.sync.low);

    for (var position=0; position < binaryCode.length; position++) {
      var bit = binaryCode.charAt(position);
      rpio.write(pin, rpio.HIGH);
      rpio.usleep(this.config.pulse[bit].high);
      rpio.write(pin, rpio.LOW);
      rpio.usleep(this.config.pulse[bit].low);
    }
  }
};

module.exports = PiRFPlatform;
