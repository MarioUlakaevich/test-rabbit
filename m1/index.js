const express = require('express');
const amqp = require('amqplib');
const apiRoutes = require('./routes/api.routes');

const app = express();
app.use(express.json());

let channel;

async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue(process.env.QUEUE_NAME);
        
        app.use('', apiRoutes(channel)); 
        app.listen(3000, () => {
            console.log("Сервер запущен на порту 3000");
        });
    } catch (error) {
        console.error("Ошибка подключения к RabbitMQ:", error);
    }
}

connectRabbitMQ().catch(console.error);