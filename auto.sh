#! usr/bin/bash

cd ./web
yarn build
cd ..
python ./label_studio/manage.py collectstatic --no-input
python ./label_studio/manage.py runserver

