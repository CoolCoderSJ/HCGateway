from .routes import v1

def init_app(app):
    app.register_blueprint(v1)