from .routes import v2

def init_app(app):
    app.register_blueprint(v2)