const express = require('express');
const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";
const FIRST = process.env.FIRST || "first_queue";
const SECOND = process.env.SECOND || "second_queue";

const app = express();
app.use(express.json());

let channel, connection;
const responsePromises = new Map();

async function connect() {
    try {
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue(FIRST, { exclusive: true });
        logger.info(" [x] Подключение к RabbitMQ успешно");
    } catch (error) {
        console.error(" [x] Ошибка подключения к RabbitMQ:", error);
    }
}

setTimeout(() => {
    connect().then(()=>{
        channel.consume(FIRST, (msg) => {
            logger.info(` [x] Пришло сообщение от второго сервиса с id: ${msg.properties.correlationId}`);
            const correlationId = msg.properties.correlationId;
            const responseResolve = responsePromises.get(correlationId);
            if (responseResolve) {
                responseResolve(JSON.parse(msg.content));
                responsePromises.delete(correlationId);
            }
        }, { noAck: true });
    }).catch(console.error);
    
}, 13000);

app.post('/api/v1/queue', async (req, res) => {
    const {number} = req.body;
    const correlationId = uuidv4();

    logger.info(` [x] Отправка числа ${number} с id: ${correlationId}`);

    const responsePromise = new Promise((resolve, reject) => {
        responsePromises.set(correlationId, resolve);
        setTimeout(() => {
            responsePromises.delete(correlationId);
            reject(new Error(' [x] Долгое ожидание ответа со второго сервера! Завершение задачи.'));
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
    logger.info("Первый сервис запущен на порту 3000");
});
