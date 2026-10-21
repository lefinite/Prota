#!/usr/bin/env python3
"""Bind the existing Vercel share domain using local credentials only."""
import argparse
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.deployer import configure_vercel
parser = argparse.ArgumentParser()
parser.add_argument('--domain', required=True)
parser.add_argument('--project', help='Optional existing project ID or name')
args = parser.parse_args()
try:
    config = configure_vercel(args.domain, args.project)
    print('已绑定分享项目：' + config['projectName'] + '；域名：' + config['staticDomain'])
except Exception as error:
    parser.exit(1, str(error) + '\n')
