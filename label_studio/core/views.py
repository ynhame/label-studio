"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license."""

import io
import json
import logging
import mimetypes
import os
import posixpath
import sys
from pathlib import Path
from wsgiref.util import FileWrapper

import pandas as pd
from core import utils
from core.feature_flags import all_flags, get_feature_file_path
from core.label_config import generate_time_series_json
from core.utils.common import collect_versions
from core.utils.io import find_file
from django.conf import settings
from django.contrib.auth import logout
from django.db.models import CharField, F, Value
from django.http import (
    HttpResponse,
    HttpResponseForbidden,
    HttpResponseNotFound,
    HttpResponseServerError,
    JsonResponse,
)
from django.shortcuts import redirect, reverse
from django.template import loader
from django.utils._os import safe_join
from drf_yasg.utils import swagger_auto_schema
from io_storages.localfiles.models import LocalFilesImportStorage
from ranged_fileresponse import RangedFileResponse
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


_PARAGRAPH_SAMPLE = None


def main(request):
    user = request.user

    if user.is_authenticated:
        if user.active_organization is None and "organization_pk" not in request.session:
            logout(request)
            return redirect(reverse("user-login"))

        # business mode access
        return redirect(reverse("projects:project-index"))

    # not authenticated
    return redirect(reverse("user-login"))


def version_page(request):
    """Get platform version"""
    # update the latest version from pypi response
    # from label_studio.core.utils.common import check_for_the_latest_version
    # check_for_the_latest_version(print_message=False)
    http_page = request.path == "/version/"
    result = collect_versions(force=http_page)

    # html / json response
    if request.path == "/version/":
        # other settings from backend
        if request.user.is_superuser:
            result["settings"] = {
                key: str(getattr(settings, key))
                for key in dir(settings)
                if not key.startswith("_") and not hasattr(getattr(settings, key), "__call__")
            }

        result = json.dumps(result, indent=2)
        result = result.replace("},", "},\n").replace("\\n", " ").replace("\\r", "")
        return HttpResponse("<pre>" + result + "</pre>")
    else:
        return JsonResponse(result)


def health(request):
    """System health info"""
    logger.debug("Got /health request.")
    return HttpResponse(json.dumps({"status": "UP"}))


def poligonos_car(request):
    if request.method == "POST":
        print(f"{request.headers=}")
        print(f"{request.body=}")
    car_regions = [
        [23, 20, 23, 160, 70, 93, 150, 109, 290, 139, 270, 93],
        [160, 70, 93, 150, 109, 290, 139, 270, 93, 23],
    ]
    return JsonResponse({"car_regions": car_regions})


def metrics(request):
    """Empty page for metrics evaluation"""
    return JsonResponse(response)


class TriggerAPIError(APIView):
    """500 response for testing"""

    authentication_classes = ()
    permission_classes = ()

    @swagger_auto_schema(auto_schema=None)
    def get(self, request):
        raise Exception("test")


def editor_files(request):
    """Get last editor files"""
    response = utils.common.find_editor_files()
    return HttpResponse(json.dumps(response), status=200)


def custom_500(request):
    """Custom 500 page"""
    t = loader.get_template("500.html")
    type_, value, tb = sys.exc_info()
    return HttpResponseServerError(t.render({"exception": value}))


def samples_time_series(request):
    """Generate time series example for preview"""
    time_column = request.GET.get("time", "")
    value_columns = request.GET.get("values", "").split(",")
    time_format = request.GET.get("tf")

    # separator processing
    separator = request.GET.get("sep", ",")
    separator = separator.replace("\\t", "\t")
    aliases = {"dot": ".", "comma": ",", "tab": "\t", "space": " "}
    if separator in aliases:
        separator = aliases[separator]

    # check headless or not
    header = True
    if all(n.isdigit() for n in [time_column] + value_columns):
        header = False

    # generate all columns for headless csv
    if not header:
        max_column_n = max([int(v) for v in value_columns] + [0])
        value_columns = range(1, max_column_n + 1)

    ts = generate_time_series_json(time_column, value_columns, time_format)
    csv_data = pd.DataFrame.from_dict(ts).to_csv(index=False, header=header, sep=separator).encode("utf-8")

    # generate response data as file
    filename = "time-series.csv"
    response = HttpResponse(csv_data, content_type="application/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response["filename"] = filename
    return response


def samples_paragraphs(request):
    """Generate paragraphs example for preview"""
    global _PARAGRAPH_SAMPLE

    if _PARAGRAPH_SAMPLE is None:
        with open(find_file("paragraphs.json"), encoding="utf-8") as f:
            _PARAGRAPH_SAMPLE = json.load(f)
    name_key = request.GET.get("nameKey", "author")
    text_key = request.GET.get("textKey", "text")

    result = []
    for line in _PARAGRAPH_SAMPLE:
        result.append({name_key: line["author"], text_key: line["text"]})

    return HttpResponse(json.dumps(result), content_type="application/json")


def plotting(request):
    """Generate paragraphs example for preview"""
    from random import randrange as rng

    dates_and_values = [
        ["2019-01-01", 87],
        ["2019-02-01", 97],
        ["2019-03-04", 81],
        ["2019-04-04", 67],
        ["2019-05-05", 15],
        ["2019-06-05", 69],
        ["2019-07-06", 49],
        ["2019-08-06", 58],
        ["2019-09-06", 49],
        ["2019-10-07", 94],
        ["2019-11-07", 25],
        ["2019-12-08", 56],
        ["2020-01-08", 9],
        ["2020-02-08", 86],
        ["2020-04-10", 13],
        ["2020-05-11", 60],
        ["2020-06-11", 6],
        ["2020-07-12", 27],
        ["2020-08-12", 16],
        ["2020-09-12", 66],
        ["2020-11-13", 55],
        ["2020-12-14", 62],
        ["2021-01-14", 51],
        ["2021-02-14", 6],
        ["2021-03-17", 37],
        ["2021-04-17", 13],
        ["2021-06-18", 84],
        ["2021-07-19", 4],
        ["2021-08-19", 31],
        ["2021-09-19", 35],
        ["2021-10-20", 13],
        ["2021-11-20", 99],
        ["2021-12-21", 32],
        ["2022-01-21", 90],
        ["2022-02-21", 84],
        ["2022-03-24", 60],
        ["2022-04-24", 23],
        ["2022-05-25", 76],
        ["2022-06-25", 25],
        ["2022-07-26", 88],
        ["2022-08-26", 12],
        ["2022-09-26", 13],
        ["2022-10-27", 55],
        ["2022-11-27", 59],
        ["2022-12-28", 99],
    ]
    values = [
        (
            value[0],  # date
            value[1] + rng(-20, -10),  # Q1
            value[1] + rng(-5, 5),  # median
            value[1],  # mean
            value[1] + rng(10, 20),  # Q3
        )
        for value in dates_and_values
    ]
    response = {"response": [{"name": "NDVI", "values": values}]}

    if request.method == "GET":
        print(f"{request.POST=}\n{request.GET=}")
        print(response)
        return JsonResponse(response)
    elif request.method == "POST":
        print(f"{request.headers=}")
        print(f"{request.body=}")
        print(response)
        return JsonResponse(response)
    return JsonResponse(response)

    # if _PARAGRAPH_SAMPLE is None:
    #     with open(find_file('paragraphs.json'), encoding='utf-8') as f:
    #         _PARAGRAPH_SAMPLE = json.load(f)
    # name_key = request.GET.get('nameKey', 'author')
    # text_key = request.GET.get('textKey', 'text')
    #
    # result = []
    # for line in _PARAGRAPH_SAMPLE:
    #     result.append({name_key: line['author'], text_key: line['text']})
    #
    # return HttpResponse(json.dumps(result), content_type='application/json')


def localfiles_data(request):
    """Serving files for LocalFilesImportStorage"""
    user = request.user
    path = request.GET.get("d")
    if settings.LOCAL_FILES_SERVING_ENABLED is False:
        return HttpResponseForbidden(
            "Serving local files can be dangerous, so it's disabled by default. "
            "You can enable it with LOCAL_FILES_SERVING_ENABLED environment variable, "
            "please check docs: https://labelstud.io/guide/storage.html#Local-storage"
        )

    local_serving_document_root = settings.LOCAL_FILES_DOCUMENT_ROOT
    if path and request.user.is_authenticated:
        path = posixpath.normpath(path).lstrip("/")
        full_path = Path(safe_join(local_serving_document_root, path))
        user_has_permissions = False

        # Try to find Local File Storage connection based prefix:
        # storage.path=/home/user, full_path=/home/user/a/b/c/1.jpg =>
        # full_path.startswith(path) => True
        localfiles_storage = LocalFilesImportStorage.objects.annotate(
            _full_path=Value(os.path.dirname(full_path), output_field=CharField())
        ).filter(_full_path__startswith=F("path"))
        if localfiles_storage.exists():
            user_has_permissions = any(storage.project.has_permission(user) for storage in localfiles_storage)

        if user_has_permissions and os.path.exists(full_path):
            content_type, encoding = mimetypes.guess_type(str(full_path))
            content_type = content_type or "application/octet-stream"
            return RangedFileResponse(request, open(full_path, mode="rb"), content_type)
        else:
            return HttpResponseNotFound()

    return HttpResponseForbidden()


def static_file_with_host_resolver(path_on_disk, content_type):
    """Load any file, replace {{HOSTNAME}} => settings.HOSTNAME, send it as http response"""
    path_on_disk = os.path.join(os.path.dirname(__file__), path_on_disk)

    def serve_file(request):
        with open(path_on_disk, "r") as f:
            body = f.read()
            body = body.replace("{{HOSTNAME}}", settings.HOSTNAME)

            out = io.StringIO()
            out.write(body)
            out.seek(0)

            wrapper = FileWrapper(out)
            response = HttpResponse(wrapper, content_type=content_type)
            response["Content-Length"] = len(body)
            return response

    return serve_file


def feature_flags(request):
    user = request.user
    if not user.is_authenticated:
        return HttpResponseForbidden()

    flags = all_flags(request.user)
    flags["$system"] = {
        "FEATURE_FLAGS_DEFAULT_VALUE": settings.FEATURE_FLAGS_DEFAULT_VALUE,
        "FEATURE_FLAGS_FROM_FILE": settings.FEATURE_FLAGS_FROM_FILE,
        "FEATURE_FLAGS_FILE": get_feature_file_path(),
        "VERSION_EDITION": settings.VERSION_EDITION,
        "CLOUD_INSTANCE": settings.CLOUD_INSTANCE if hasattr(settings, "CLOUD_INSTANCE") else None,
    }

    return HttpResponse("<pre>" + json.dumps(flags, indent=4) + "</pre>", status=200)
