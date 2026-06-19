import SibApiV3Sdk from "sib-api-v3-sdk";

export const sendEmail = async ({ email, subject, message }) => {
  try {

    const defaultClient = SibApiV3Sdk.ApiClient.instance;

    const apiKey = defaultClient.authentications["api-key"];

    apiKey.apiKey = process.env.BREVO_API_KEY;

    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    const sendSmtpEmail = {
      sender: {
        email: process.env.SMTP_MAIL,
        name: "GAON SE",
      },

      to: [
        {
          email: email,
        },
      ],

      subject: subject,

      htmlContent: message,
    };

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    return data;

  } catch (error) {
    console.log("BREVO EMAIL ERROR:", error);
    throw error;
  }
};