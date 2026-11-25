"""Copy into /var/www/slidar_pythonanywhere_com_wsgi.py on PythonAnywhere."""
import os
import sys

os.environ['QADAM_COOKIE_SECURE'] = '1'
project_path = '/home/Slidar/qadam'
if project_path not in sys.path:
    sys.path.insert(0, project_path)

from app import app as application
