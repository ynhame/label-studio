#! usr/bin/bash

cd ./web
yarn build
# cp -r -f dist ../label_studio/core/static
cd ..
python ./label_studio/manage.py collectstatic --no-input
python ./label_studio/manage.py runserver

