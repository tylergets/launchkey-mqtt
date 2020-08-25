require('dotenv').config()

const { Launchkey } = require('@vliegwerk/novation')
const mqtt = require('mqtt')
const {EventEmitter } = require("events");

class MqttWrapper extends EventEmitter {
    client;

    constructor(client) {
        super();
        this.client = client;
    }

    publish(topic, body) {
        setTimeout(() => {
            console.log('publish', topic, JSON.stringify(body));
            this.client.publish(topic, JSON.stringify(body), {}, (err, packet) => {
                if(err) {
                    console.error(err);
                }
            })
        }, 0)
    }

    on(topic, cb) {
        this.client.on(topic, cb);
    }

    subscribe(topic) {
        this.client.subscribe(topic);
    }
}

const controller = new Launchkey({
    midiInput: 'Launchkey Mini:Launchkey Mini MIDI 1 36:0',
    midiOutput: 'Launchkey Mini:Launchkey Mini MIDI 1 36:0',
    dawInput: 'Launchkey Mini:Launchkey Mini MIDI 2 36:1',
    dawOutput: 'Launchkey Mini:Launchkey Mini MIDI 2 36:1',
    device: 'Launchkey Mini',
});

controller.on('connected', async () => {

    console.log('Connected to controller');

    controller.extendedMode()
    controller.reset()

    for (let x = 0; x < 9; x++) {
        for (let y = 0; y < 2; y++) {
            controller.ledOn(x, y, Launchkey.color(4, 0))
        }
    }

    const client = new MqttWrapper(mqtt.connect(process.env.MQTT_CONNECTION, {
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
    }));

    client.on('connect', function () {
        console.log('Connected to MQTT');

        for (let x = 0; x < 9; x++) {
            for (let y = 0; y < 2; y++) {
                controller.ledOn(x, y, Launchkey.color(0, 5))
            }
        }

        client.publish("launchkey/online", true);
    })

    client.on('error', (error) => {
        console.error(error);
    })

    client.on('end', () => {
        console.error('end');
    })
    client.on('reconnect', () => {
        console.error('reconnect');
    })
    client.on('close', () => {
        console.error('close');
    })

    client.on('end', () => {
        console.error('end');
    })

    client.subscribe('launchkey/color/#');


    client.on('message', function (topic, message) {
        if (topic.includes("launchkey/color")) {
            let x = topic.split("/")[2];
            let y = topic.split("/")[3];
            const data = JSON.parse(message.toString());
            const {red, green} = data;
            if (!x || !y) {
                x = data.x;
                y = data.y;
            }
            controller.ledOn(x, y, Launchkey.color(red, green))
        }
    })

    controller.on('NoteOn', (message) => {
        client.publish(`launchkey/key/${message.note}/on`, message)
    });

    controller.on('NoteOff', (message) => {
        client.publish(`launchkey/key/${message.note}/off`, message)
    });

    controller.on('ControlChange', (message) => {
        client.publish(`launchkey/control/${message.control}/value`, message)
    });
});

controller.on('error', (err) => {
    console.error('Unable to connect to controller: ', err)
})

controller.connect()
