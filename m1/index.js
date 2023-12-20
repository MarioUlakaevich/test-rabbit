const express = require('express');
const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";
const FIRST = process.env.FIRST || "first";
const SECOND = process.env.SECOND || "second";

const app = express();
app.use(express.json());

let channel, connection;
const responsePromises = new Map();

async function connect() {
    try {
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue('', { exclusive: true });
    } catch (error) {
        console.error("Ошибка подключения к RabbitMQ:", error);
    }
}

connect().then(()=>{
    channel.consume(FIRST, (msg) => {
        const correlationId = msg.properties.correlationId;
        const responseResolve = responsePromises.get(correlationId);
        if (responseResolve) {
            responseResolve(JSON.parse(msg.content.toString()));
            responsePromises.delete(correlationId);
        }
    }, { noAck: true });
}).catch(console.error);

app.post('/api/v1/queue', async (req, res) => {
    const {number} = req.body;
    const correlationId = uuidv4();

    console.log(` [x] Отправка числа ${number}, id ${correlationId}`);

    const responsePromise = new Promise((resolve, reject) => {
        responsePromises.set(correlationId, resolve);
        setTimeout(() => {
            responsePromises.delete(correlationId);
            reject(new Error('Timeout waiting for response from RabbitMQ'));
        }, 7000);
    });
    channel.sendToQueue(
        SECOND, 
        Buffer.from(JSON.stringify({ number })), 
        { correlationId, replyTo: FIRST }
    );

    try {
        const response = await responsePromise;
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }

});



app.listen(3000, () => {
    console.log("Первый сервис запущен на порту 3000");
});
