
from flask import Flask , render_template , url_for

app = Flask(__name__)


@app.route('/')
def home():
    return render_template('home.html')

@app.route('/api/send_query',methods=['GET','POST'])
def send_query():
    return render_template('send_query.html')

@app.route('/api/push_dbs',methods=['GET','POST'])
def push_dbs():
    return render_template('send_query.html')


if __name__ == '__main__':
    app.run(debug=True)