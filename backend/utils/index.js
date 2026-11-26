
const sendSuccess = (res, statusCode = 200, message = "Success", data = {}) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
};

const sendError = (res, statusCode = 500, message = "Internal Server Error", error = null) => {
    return res.status(statusCode).json({
        success: false,
        message,
        error: error?.message || error || null,
        // A stable machine-readable reason, when the error carries one (auth
        // errors do), so a client can act on it without matching message text.
        ...(error && typeof error === 'object' && error.code && typeof error.code === 'string' ? { code: error.code } : {}),
    });
};

const handleValidationError = (res, error) => {
    if (error.name === "ValidationError" && Array.isArray(error.errors)) {
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: error.errors, // All detailed messages from yup
        });
    }

    return res.status(400).json({
        success: false,
        message: error.message || "Invalid input data.",
    });
};

module.exports = {
    sendSuccess,
    sendError,
    handleValidationError
}