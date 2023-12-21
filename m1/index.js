// Импорт зависимостей
const express = require('express');
const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

// Переменные среды
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";
const FIRST = process.env.FIRST || "first_queue";
const SECOND = process.env.SECOND || "second_queue";

const app = express();
app.use(express.json());

let channel, connection;
const responsePromises = new Map(); //  Создание Map для хранения промисов и их резолвов

//Функция подключения к RabbitMQ
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

// Создаю подключение с задержкой в 13 сек, чтобы RabbitMQ успел подняться
// Создаю консьюмер для первого сервиса. При получении сообщения вызывается функция, которая резолвит промис
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

// Маршрутизатор первого сервиса для обработки POST запроса.
// В нём содаем промис который ждёт ответа от второго сервиса. Если ответа нет в течение 7 секунд, то завершаем задачу
// Отправляем полученные данные из POST запроса второму сервису на обработку. После получения ответа возвращаем его клиенту
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
