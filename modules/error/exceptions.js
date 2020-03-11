
class DefaultException extends Error {
    constructor (message = "Something went wrong", status = 500, content = null, ...params) {
        super(...params);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DefaultException);
        }

        this.exception = "Default";
        this.message = message;
        this.status = status;
        this.content = content;
        this.date = new Date();
    }
}

class WithMessageException extends DefaultException {
    constructor (title = "Oops", message = "Something went wrong", status = 500, exception = null, ...params) {
        super(...params);
        this.status = status;
        this.content = { title, message };
        this.message = `${title}: ${message}`;
        if (exception) { this.exception = exception; }
        delete this.title;
    }
}

class ServerInternalException extends DefaultException {
    constructor (message = "Server Internal Error", status = 500, ...params) {
        super(message, status, ...params);
        this.exception = "ServerInternal";
    }
}

class PayloadTooLargeException extends DefaultException {
    constructor (message = "Payload Too Large ", status = 413, ...params) {
        super(message, status, ...params);
        this.exception = "PayloadTooLarge";
    }
}

class ServiceUnavailableException extends DefaultException {
    constructor (message = "Server Unavailable Error", status = 503, ...params) {
        super(message, status, ...params);
        this.exception = "ServiceUnavailable";
    }
}
class BadRequestException extends DefaultException {
    constructor (message = "Bad Request", status = 400, ...params) {
        super(message, status, ...params);
        this.exception = "BadRequest";
    }
}

class NotFoundException extends DefaultException {
    constructor (message = "Not Found", status = 404, ...params) {
        super(message, status, ...params);
        this.exception = "NotFound";
    }
}
class ForbiddenException extends DefaultException {
    constructor (message = "Forbidden", status = 403, ...params) {
        super(message, status, ...params);
        this.exception = "Forbidden";
    }
}

class ConflictException extends DefaultException {
    constructor (message = "Conflict", status = 409, ...params) {
        super(message, status, ...params);
        this.exception = "Conflict";
    }
}

class UnauthorizedException extends DefaultException {
    constructor (message = "Unauthorized", status = 401, ...params) {
        super(message, status, ...params);
        this.exception = "Unauthorized";
    }
}

module.exports = {
    DefaultException,
    WithMessageException,
    ServerInternalException,
    BadRequestException,
    NotFoundException,
    ServiceUnavailableException,
    PayloadTooLargeException,
    ForbiddenException,
    ConflictException,
    UnauthorizedException
};
