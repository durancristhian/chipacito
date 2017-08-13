if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const fetch = require('node-fetch');
const fs = require('fs');
const { get, post, router } = require('microrouter');
const microCors = require('micro-cors');
const nodemailer = require('nodemailer');
const parse = require('urlencoded-body-parser');
const { send } = require('micro');

const cors = microCors({ allowMethods: ['GET', 'POST'] });
const html = fs.readFileSync(__dirname + '/index.html');
const transporter = nodemailer.createTransport(
    {
        service: 'Gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASSWORD
        }
    },
    {
        from: process.env.GMAIL_USER
    }
);

async function handleFormRequest(req, res) {
    const formData = await parse(req);
    const recaptcha = formData['g-recaptcha-response'];

    if (!recaptcha) {
        return send(res, 412, { error_code: 'INVALID_RECAPTCHA', message: 'Invalid recaptcha' });
    }

    const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env
        .RECAPTCHA_SECRET}&response=${recaptcha}`;

    const verificationResponse = await fetch(verificationURL);
    const { success } = await verificationResponse.json();

    if (!success) {
        return send(res, 401, {
            error_code: 'ERROR_RECAPTCHA',
            message: 'Error trying to verify recaptcha'
        });
    }

    const message = {
        to: formData.email,
        subject: `${formData.name} envió un mensaje`,
        text: `${formData.message}\n\n${formData.name}`
    };

    try {
        const success = await sendEmail(transporter, message);

        send(res, 200, success);
    } catch (error) {
        send(res, 500, error);
    }
}

async function sendEmail(transporter, message) {
    return new Promise(function(resolve, reject) {
        transporter.sendMail(message, (error, info) => {
            if (error) {
                return reject({
                    error_code: 'ERROR_EMAIL',
                    message: 'Error trying to send the email'
                });
            }

            transporter.close();
            resolve({ success: true });
        });
    });
}

function sendFile(req, res) {
    res.end(html);
}

function sendStatusMessage(req, res) {
    send(res, 200, { status: 'running' });
}

module.exports = cors(
    router(
        get('/', process.env.NODE_ENV !== 'production' ? sendFile : sendStatusMessage),
        post('/', handleFormRequest)
    )
);
