# kdbx2bw - Keepass to Bitwarden migration tool

## Introduction

This tool migrates a keepass database a Bitwarden vault of an organization. The following features are supported:

* Migrate the folder structure to Bitwarden collections (using slash notation thus creating a folder tree)
* Support Attachments of entries
* Support entry icons

## Building

With an installed Node.JS, run the following command to build the tool:

    npm install

## Usage

The tool requires some parameters to run, run the following command to view the command help:

    node kdbx2bw.js --help

## Configuration with environment variables

Configuration can also be done using environment variables. Simply use the long names of the parameters in CONSTANT_CASE
as environment keys.

For example the parameter --bitwardenOrganizationId corresponds to the environment variable BITWARDEN_ORGANIZATION_ID
